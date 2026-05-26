/**
 * Mesh Coordination Layer
 * Implements local peer discovery and Raft-inspired Bully leader election.
 */

import { db } from './db';
import { networkMonitor } from './network';
import { getOrCreateDeviceId } from './device';
import { Telemetry } from '@/lib/telemetry/telemetry';

export interface MeshPeer {
  id: string;
  lastSeen: number;
  ledgerPosition: number;
  uptime: number;
  batteryLevel: number;
  isCharging: boolean;
  connectionQuality: string;
  isLeader: boolean;
  term: number;
}

export interface MeshMessage {
  type: 'heartbeat' | 'election_proclamation' | 'sync_request' | 'sync_response';
  senderId: string;
  payload: any;
  term: number;
}

export interface MeshTransport {
  publish(msg: MeshMessage): Promise<void>;
  subscribe(handler: (msg: MeshMessage) => void): void;
}

import { assertClient } from '@/lib/client-only';

class MockBroadcastChannel {
  postMessage(msg: any) {}
  close() {}
  onmessage: any = null;
}

/**
 * BroadcastChannel implementation for simulated multi-device mesh (tabs/iframes)
 */
export class BroadcastChannelTransport implements MeshTransport {
  private channel: BroadcastChannel | MockBroadcastChannel;
  private handlers: ((msg: MeshMessage) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.channel = new BroadcastChannel('nexpos_mesh');
      this.channel.onmessage = (event) => {
        this.handlers.forEach(h => h(event.data));
      };
    } else {
      this.channel = new MockBroadcastChannel();
    }
  }

  async publish(msg: MeshMessage): Promise<void> {
    this.channel.postMessage(msg);
  }

  subscribe(handler: (msg: MeshMessage) => void): void {
    this.handlers.push(handler);
  }
}

export class MeshManager {
  private transport: MeshTransport;
  private peers: Map<string, MeshPeer> = new Map();
  private currentDeviceId: string = '';
  private currentTerm: number = 0;
  private isLeader: boolean = false;
  private startTime: number = Date.now();
  private heartbeatInterval?: NodeJS.Timeout;
  private electionTimeout?: NodeJS.Timeout;
  private cooldownActive: boolean = false;

  constructor(transport: MeshTransport) {
    assertClient('MeshManager');
    this.transport = transport;
    this.transport.subscribe(this.handleMessage.bind(this));
    this.init();
  }

  private async init() {
    this.currentDeviceId = await getOrCreateDeviceId();
    this.startHeartbeat();
    this.resetElectionTimeout();
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(async () => {
      await this.broadcastHeartbeat();
      this.checkPeerExpiries();
    }, 2000);
  }

  private resetElectionTimeout() {
    if (this.electionTimeout) clearTimeout(this.electionTimeout);
    
    // 6 second lease expiry + randomized jitter (0-2s) to prevent election storms
    const timeout = 6000 + (Math.random() * 2000);
    this.electionTimeout = setTimeout(() => {
      if (!this.isLeader) {
        this.attemptElection();
      }
    }, timeout);
  }

  private async broadcastHeartbeat() {
    const status = await networkMonitor.getStatus();
    const ledgerPos = await this.getLedgerPosition();
    
    const peerInfo: MeshPeer = {
      id: this.currentDeviceId,
      lastSeen: Date.now(),
      ledgerPosition: ledgerPos,
      uptime: Date.now() - this.startTime,
      batteryLevel: status.batteryLevel,
      isCharging: status.isCharging,
      connectionQuality: status.quality,
      isLeader: this.isLeader,
      term: this.currentTerm
    };

    await this.transport.publish({
      type: 'heartbeat',
      senderId: this.currentDeviceId,
      term: this.currentTerm,
      payload: peerInfo
    });

    if (this.isLeader) {
      await Telemetry.trackMeshHeartbeat(this.peers.size, this.currentDeviceId, this.currentTerm);
    }
  }

  private handleMessage(msg: MeshMessage) {
    // Drop messages from self
    if (msg.senderId === this.currentDeviceId) return;

    // Update Term if seen higher
    if (msg.term > this.currentTerm) {
      const oldLeader = Array.from(this.peers.values()).find(p => p.isLeader)?.id || 'unknown';
      this.currentTerm = msg.term;
      this.isLeader = false; // Step down
      Telemetry.trackMeshFailover(oldLeader, msg.senderId, msg.term);
    }

    if (msg.type === 'heartbeat') {
      const peer: MeshPeer = msg.payload;
      this.peers.set(peer.id, { ...peer, lastSeen: Date.now() });

      if (peer.isLeader) {
        if (peer.term >= this.currentTerm) {
          this.resetElectionTimeout();
          if (this.isLeader && peer.id !== this.currentDeviceId) {
             // Split brain detected! Leader with lower ID wins
             if (peer.id < this.currentDeviceId) {
                this.isLeader = false;
                Telemetry.trackMeshSplitBrain(peer.id, this.currentTerm);
                console.warn('Split-brain: Stepping down as leader (Lower UUID peer seen)');
             }
          }
        }
      }
    } else if (msg.type === 'election_proclamation') {
       if (msg.term >= this.currentTerm) {
          const oldLeader = Array.from(this.peers.values()).find(p => p.isLeader)?.id || 'unknown';
          this.isLeader = false;
          this.resetElectionTimeout();
          Telemetry.trackMeshFailover(oldLeader, msg.senderId, msg.term);
       }
    }
  }

  private checkPeerExpiries() {
    const now = Date.now();
    for (const [id, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > 10000) { // 10s peer expiry
        this.peers.delete(id);
      }
    }
  }

  private async getLedgerPosition(): Promise<number> {
    // Simplified: highest global_position seen or total events processed
    // In NEXPOS, we can check the latest sequence number in queue or projections
    return await db.queue_tier_0.count() + await db.queue_tier_1.count(); 
  }

  private calculateScore(peer: MeshPeer): number {
    let score = 0;
    score += peer.ledgerPosition * 1000;
    score += (peer.uptime / 1000) * 10;
    score += peer.batteryLevel * 100;
    if (peer.isCharging) score += 50;
    if (peer.connectionQuality === 'excellent') score += 100;
    if (peer.connectionQuality === 'good') score += 50;
    return score;
  }

  private async attemptElection() {
    if (this.cooldownActive) return;
    
    const status = await networkMonitor.getStatus();
    const myPeer: MeshPeer = {
       id: this.currentDeviceId,
       lastSeen: Date.now(),
       ledgerPosition: await this.getLedgerPosition(),
       uptime: Date.now() - this.startTime,
       batteryLevel: status.batteryLevel,
       isCharging: status.isCharging,
       connectionQuality: status.quality,
       isLeader: false,
       term: this.currentTerm
    };

    const myScore = this.calculateScore(myPeer);
    let canBeLeader = true;

    for (const peer of this.peers.values()) {
       const peerScore = this.calculateScore(peer);
       if (peerScore > myScore) {
          canBeLeader = false;
          break;
       } else if (peerScore === myScore) {
          if (peer.id < this.currentDeviceId) {
             canBeLeader = false;
             break;
          }
       }
    }

    if (canBeLeader) {
       this.currentTerm++;
       this.isLeader = true;
       console.log(`Elected as Branch Leader for term ${this.currentTerm}`);
       Telemetry.trackMeshElection(this.currentDeviceId, this.currentTerm, true);
       await this.transport.publish({
          type: 'election_proclamation',
          senderId: this.currentDeviceId,
          term: this.currentTerm,
          payload: { deviceId: this.currentDeviceId }
       });
       this.startHeartbeat();
    }
    
    // Cooldown jitter to prevent rapid re-elections
    this.cooldownActive = true;
    setTimeout(() => this.cooldownActive = false, 2000 + Math.random() * 2000);
  }

  public getStatus() {
    return {
      deviceId: this.currentDeviceId,
      isLeader: this.isLeader,
      term: this.currentTerm,
      peerCount: this.peers.size,
      peers: Array.from(this.peers.values())
    };
  }
}

let _meshManager: MeshManager | null = null;

export function getMeshManager(): MeshManager {
  if (typeof window === 'undefined') {
    // Return a dummy proxy to prevent crash during import/pre-rendering on server side
    return new Proxy({} as any, {
      get(target, prop) {
        if (prop === 'getStatus') {
          return () => ({
            deviceId: 'server-side',
            isLeader: false,
            term: 0,
            peerCount: 0,
            peers: []
          });
        }
        throw new Error(`MeshManager is not available on the server. Attempted to access property "${String(prop)}".`);
      }
    });
  }

  assertClient('meshManager');

  if (!_meshManager) {
    _meshManager = new MeshManager(new BroadcastChannelTransport());
  }
  return _meshManager;
}

export const meshManager = new Proxy({} as MeshManager, {
  get(target, prop) {
    const activeMeshManager = getMeshManager();
    const value = (activeMeshManager as any)[prop];
    if (typeof value === 'function') {
      return value.bind(activeMeshManager);
    }
    return value;
  }
});
