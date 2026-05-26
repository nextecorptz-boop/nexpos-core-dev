/**
 * NetworkMonitor
 * Tracks RTT, battery state, and connection quality for adaptive synchronization.
 */

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

export interface NetworkStatus {
  online: boolean;
  rtt: number; // ms
  effectiveType: string; // '4g', '3g', etc.
  saveData: boolean;
  batteryLevel: number; // 0 to 1
  isCharging: boolean;
  quality: ConnectionQuality;
}

class NetworkMonitor {
  private rttHistory: number[] = [];
  private readonly MAX_HISTORY = 10;
  private currentRtt: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.recordRtt(50)); // Reset with optimistic RTT
      window.addEventListener('offline', () => this.currentRtt = 9999);
    }
  }

  /**
   * Records a new RTT measurement from an API call
   */
  recordRtt(ms: number) {
    this.rttHistory.push(ms);
    if (this.rttHistory.length > this.MAX_HISTORY) {
      this.rttHistory.shift();
    }
    this.currentRtt = this.rttHistory.reduce((a, b) => a + b, 0) / this.rttHistory.length;
  }

  /**
   * Gets the current consolidated network status
   */
  async getStatus(): Promise<NetworkStatus> {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : false;
    const conn = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
    
    let batteryLevel = 1;
    let isCharging = true;
    
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        batteryLevel = battery.level;
        isCharging = battery.charging;
      } catch (e) {
        // Fallback if battery API fails
      }
    }

    const effectiveType = conn?.effectiveType || 'unknown';
    const saveData = conn?.saveData || false;
    
    // Determine Quality
    let quality: ConnectionQuality = 'good';
    if (!online) {
      quality = 'offline';
    } else if (saveData || ['slow-2g', '2g'].includes(effectiveType) || this.currentRtt > 1000) {
      quality = 'poor';
    } else if (effectiveType === '3g' || this.currentRtt > 400) {
      quality = 'fair';
    } else if (this.currentRtt > 0 && this.currentRtt < 150) {
      quality = 'excellent';
    }

    return {
      online,
      rtt: this.currentRtt,
      effectiveType,
      saveData,
      batteryLevel,
      isCharging,
      quality
    };
  }

  /**
   * Calculates optimal batch size based on network quality
   */
  async getOptimalBatchSize(tier: number): Promise<number> {
    const status = await this.getStatus();
    
    // Base batch sizes by tier
    const baseSizes = [50, 20, 10, 5]; // P0, P1, P2, P3
    let size = baseSizes[tier] || 10;

    // Adjust for quality
    if (status.quality === 'excellent') size *= 2;
    if (status.quality === 'fair') size = Math.max(1, Math.floor(size * 0.5));
    if (status.quality === 'poor') size = 1;

    // Adjust for battery
    if (status.batteryLevel < 0.15 && !status.isCharging) {
      size = Math.max(1, Math.floor(size * 0.2));
    }

    return size;
  }

  /**
   * Calculates backoff jitter
   */
  getJitter(baseMs: number): number {
    return baseMs + (Math.random() * 0.3 * baseMs);
  }
}

import { assertClient } from '@/lib/client-only';

let _networkMonitor: NetworkMonitor | null = null;

export function getNetworkMonitor(): NetworkMonitor {
  if (typeof window === 'undefined') {
    // Return a dummy proxy to prevent crash during import/pre-rendering on server side
    return new Proxy({} as any, {
      get(target, prop) {
        if (prop === 'getStatus') {
          return async () => ({
            online: false,
            rtt: 9999,
            effectiveType: 'unknown',
            saveData: false,
            batteryLevel: 1,
            isCharging: true,
            quality: 'offline'
          });
        }
        throw new Error(`NetworkMonitor is not available on the server. Attempted to access property "${String(prop)}".`);
      }
    });
  }

  assertClient('networkMonitor');

  if (!_networkMonitor) {
    _networkMonitor = new NetworkMonitor();
  }
  return _networkMonitor;
}

export const networkMonitor = new Proxy({} as NetworkMonitor, {
  get(target, prop) {
    const activeNetworkMonitor = getNetworkMonitor();
    const value = (activeNetworkMonitor as any)[prop];
    if (typeof value === 'function') {
      return value.bind(activeNetworkMonitor);
    }
    return value;
  }
});
