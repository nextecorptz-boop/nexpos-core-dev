// NEXPOS - Mesh Coordination Chaos Test Suite
// Run using: npx tsx tests/mesh-chaos.ts

// 1. MOCK BROADCASTCHANNEL BEFORE IMPORTS
class MockBroadcastChannel {
  public static channels: Map<string, Set<MockBroadcastChannel>> = new Map();
  name: string;
  onmessage: ((event: any) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
    // console.log(`[MockBC] Created ${name}. Total instances: ${MockBroadcastChannel.channels.get(name)!.size}`);
  }

  postMessage(data: any) {
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (peers) {
      peers.forEach(peer => {
        if (peer !== this && peer.onmessage) {
          // Simulate async delivery
          setTimeout(() => {
            if (peer.onmessage) peer.onmessage({ data });
          }, 10);
        }
      });
    }
  }

  close() {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

(global as any).BroadcastChannel = MockBroadcastChannel;

// 2. USE REQUIRE TO PREVENT HOISTING
import 'fake-indexeddb/auto';
const { db } = require('../lib/sync/db');
const { meshManager, MeshManager, BroadcastChannelTransport } = require('../lib/sync/mesh');
const { Telemetry } = require('../lib/telemetry/telemetry');

// Mock Telemetry
const TelemetryMock = {
  trackMeshElection: async () => {},
  trackMeshFailover: async () => {},
  trackMeshHeartbeat: async () => {},
  trackMeshSplitBrain: async () => {},
  log: async () => {}
};
Telemetry.trackMeshElection = TelemetryMock.trackMeshElection;
Telemetry.trackMeshFailover = TelemetryMock.trackMeshFailover;
Telemetry.trackMeshHeartbeat = TelemetryMock.trackMeshHeartbeat;
Telemetry.trackMeshSplitBrain = TelemetryMock.trackMeshSplitBrain;

async function runMeshChaosTests() {
  console.log('================================================================');
  console.log('      NEXPOS MESH COORDINATION & LEADER ELECTION CHAOS         ');
  console.log('================================================================\n');

  try {
    await db.open();
    console.log('✓ IndexedDB Connection established.');

    // Assign stable ID to node 1
    meshManager.currentDeviceId = 'device-1';

    // ------------------------------------------------------------------
    // TEST 1: Basic Leader Election
    // ------------------------------------------------------------------
    console.log('\n[TEST 1] Testing basic leader election (Single Node)...');
    
    // Trigger election attempt manually
    await meshManager.attemptElection();
    
    let status = meshManager.getStatus();
    console.log(`- Device ID: ${status.deviceId}`);
    console.log(`- Is Leader: ${status.isLeader}`);
    console.log(`- Current Term: ${status.term}`);

    if (status.isLeader) {
      console.log('✓ SUCCESS: Single node elected itself leader.');
    } else {
      throw new Error('FAIL: Single node failed to elect itself leader.');
    }

    // ------------------------------------------------------------------
    // TEST 2: Multi-Node Election & Tie-Breaking
    // ------------------------------------------------------------------
    console.log('\n[TEST 2] Testing multi-node election & tie-breaking...');
    
    // Create second mesh manager instance
    const transport2 = new BroadcastChannelTransport();
    const mesh2 = new MeshManager(transport2);
    
    // Wait for init and override ID
    await new Promise(r => setTimeout(r, 200));
    mesh2.currentDeviceId = 'device-2';
    
    // Trigger heartbeats to discover each other
    console.log(`- Mesh Channel size: ${MockBroadcastChannel.channels.get('nexpos_mesh')?.size}`);
    await meshManager.broadcastHeartbeat();
    await mesh2.broadcastHeartbeat();
    
    // Wait for discovery
    await new Promise(r => setTimeout(r, 1000));
    
    const status1 = meshManager.getStatus();
    const status2 = mesh2.getStatus();
    
    console.log(`- Node 1 (${status1.deviceId}): Leader=${status1.isLeader}, Peers=${status1.peerCount}`);
    console.log(`- Node 2 (${status2.deviceId}): Leader=${status2.isLeader}, Peers=${status2.peerCount}`);

    if (status1.isLeader && !status2.isLeader) {
      console.log('✓ SUCCESS: Deterministic leader maintained, second node followed.');
    } else {
       throw new Error(`FAIL: Invalid election state (L1: ${status1.isLeader}, L2: ${status2.isLeader}, P1: ${status1.peerCount}, P2: ${status2.peerCount})`);
    }

    // ------------------------------------------------------------------
    // TEST 3: Failover on Leader Crash
    // ------------------------------------------------------------------
    console.log('\n[TEST 3] Testing failover on leader crash...');
    
    console.log(`- Crashing current leader: device-1`);
    clearInterval(meshManager.heartbeatInterval);
    clearTimeout(meshManager.electionTimeout);
    meshManager.isLeader = false;
    
    console.log('- Waiting for Node 2 to detect expiry and elect itself...');
    // Trigger Node 2 election attempt manually
    await mesh2.attemptElection();
    
    const newStatus = mesh2.getStatus();
    console.log(`- Node 2 status: Leader=${newStatus.isLeader}, Term=${newStatus.term}`);

    if (newStatus.isLeader) {
      console.log('✓ SUCCESS: Node 2 successfully elected as new leader after failover.');
    } else {
      throw new Error('FAIL: Node 2 failed to take over leadership.');
    }

    // ------------------------------------------------------------------
    // TEST 4: Split-Brain Resolution
    // ------------------------------------------------------------------
    console.log('\n[TEST 4] Testing split-brain resolution...');
    
    // Force both to be leaders of the same term
    meshManager.isLeader = true;
    mesh2.isLeader = true;
    meshManager.currentTerm = 10;
    mesh2.currentTerm = 10;
    
    console.log('- Simulated split-brain: Both nodes think they are leaders of term 10.');
    
    // Trigger heartbeats
    await meshManager.broadcastHeartbeat();
    await mesh2.broadcastHeartbeat();
    
    await new Promise(r => setTimeout(r, 500));
    
    const final1 = meshManager.getStatus();
    const final2 = mesh2.getStatus();
    
    console.log(`- Node 1: Leader=${final1.isLeader}`);
    console.log(`- Node 2: Leader=${final2.isLeader}`);

    // device-1 < device-2, so Node 1 should stay leader, Node 2 should step down
    if (final1.isLeader && !final2.isLeader) {
      console.log('✓ SUCCESS: Split-brain resolved via deterministic UUID tie-breaking (device-1 won).');
    } else {
      throw new Error(`FAIL: Split-brain resolution failed (L1: ${final1.isLeader}, L2: ${final2.isLeader})`);
    }

    console.log('\n================================================================');
    console.log('         ALL MESH COORDINATION CHAOS TESTS PASSED              ');
    console.log('================================================================\n');

    process.exit(0);
  } catch (err: any) {
    console.error('\n!!! CHAOS TEST FAILED !!!');
    console.error(err.message);
    process.exit(1);
  }
}

runMeshChaosTests();
