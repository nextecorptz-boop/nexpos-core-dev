import { db } from '@/lib/sync/db';
import { updatePeerStatus } from './device-registry';
import { Telemetry } from '@/lib/telemetry/telemetry';

/**
 * Revokes a device's trust status, either local or peer.
 */
export async function revokeDevice(deviceId: string, reason: string = 'Administrative revocation'): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }

  // 1. Check if it's the local device
  const localCert = await db.device_certificates.get(deviceId);
  if (localCert) {
    localCert.status = 'revoked';
    await db.device_certificates.put(localCert);
    await Telemetry.critical('security', `Local device identity revoked: ${reason}`, { deviceId });
  }

  // 2. Check and update the trust registry for peers
  const peer = await db.device_trust_registry.get(deviceId);
  if (peer) {
    await updatePeerStatus(deviceId, 'revoked');
    await Telemetry.critical('security', `Peer device identity revoked: ${reason}`, { deviceId });
  }
}

/**
 * Quarantines a peer device.
 */
export async function quarantineDevice(deviceId: string, reason: string): Promise<void> {
  const peer = await db.device_trust_registry.get(deviceId);
  if (peer) {
    await updatePeerStatus(deviceId, 'quarantined');
    await Telemetry.error('security', `Peer device quarantined: ${reason}`, { deviceId });
  }
}

/**
 * Suspends a peer device under suspicion of compromise.
 */
export async function suspectDevice(deviceId: string, reason: string): Promise<void> {
  const peer = await db.device_trust_registry.get(deviceId);
  if (peer) {
    await updatePeerStatus(deviceId, 'suspected');
    await Telemetry.warn('security', `Peer device marked as suspected: ${reason}`, { deviceId });
  }
}
