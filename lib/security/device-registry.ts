import { db, type TrustRegistryEntry } from '@/lib/sync/db';

/**
 * Gets a peer trust entry from the registry.
 */
export async function getPeerTrustEntry(deviceId: string): Promise<TrustRegistryEntry | null> {
  if (!db.isOpen()) {
    await db.open();
  }
  const entry = await db.device_trust_registry.get(deviceId);
  return entry || null;
}

/**
 * Registers or updates a peer in the trust registry.
 */
export async function registerPeer(entry: TrustRegistryEntry): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
  await db.device_trust_registry.put(entry);
}

/**
 * Updates a peer's trust status.
 */
export async function updatePeerStatus(
  deviceId: string,
  status: TrustRegistryEntry['status']
): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
  const entry = await db.device_trust_registry.get(deviceId);
  if (entry) {
    entry.status = status;
    entry.lastSeen = new Date().toISOString();
    await db.device_trust_registry.put(entry);
  }
}

/**
 * Checks if a peer device is trusted.
 */
export async function isPeerTrusted(deviceId: string): Promise<boolean> {
  const entry = await getPeerTrustEntry(deviceId);
  return entry?.status === 'trusted';
}

/**
 * Updates the last seen nonce for a peer device (replay attack mitigation).
 */
export async function updatePeerNonce(deviceId: string, nonce: number): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
  const entry = await db.device_trust_registry.get(deviceId);
  if (entry) {
    entry.lastNonce = nonce;
    entry.lastSeen = new Date().toISOString();
    await db.device_trust_registry.put(entry);
  }
}

/**
 * Retrieves all registered devices from the trust registry.
 */
export async function listTrustRegistry(): Promise<TrustRegistryEntry[]> {
  if (!db.isOpen()) {
    await db.open();
  }
  return db.device_trust_registry.toArray();
}
