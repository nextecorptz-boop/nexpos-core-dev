import { db } from '@/lib/sync/db';
import { type DomainEvent } from '@/lib/sync/commands';
import { getOrCreateDeviceKeys, signPayload } from './device-crypto';
import { getDeviceFingerprint } from './device-identity';
import { getLocalCertificate, createSelfSignedCertificate, saveLocalCertificate } from './device-certificates';

/**
 * Signs a DomainEvent payload, attaching signature, nonce, fingerprint,
 * and public key info to event.metadata.
 * Nonce is per-device scoped and incremented atomically inside a database transaction.
 */
export async function signEvent(event: DomainEvent): Promise<DomainEvent> {
  if (!db.isOpen()) {
    await db.open();
  }

  // 1. Load/generate device keys
  const keys = await getOrCreateDeviceKeys();

  // 2. Load/generate device certificate
  let cert = await getLocalCertificate(keys.deviceId);
  if (!cert) {
    cert = await createSelfSignedCertificate(
      keys.deviceId,
      event.tenant_id,
      keys.publicKeyJwk,
      keys.privateKey
    );
    await saveLocalCertificate(cert);
  }

  // 3. Atomically increment the persistent, per-device scoped signature nonce
  const nonce = await db.transaction('rw', db.settings, async () => {
    const rec = await db.settings.get('device_signature_nonce');
    const current = rec ? Number(rec.value) : 0;
    const next = current + 1;
    await db.settings.put({ key: 'device_signature_nonce', value: next });
    return next;
  });

  // 4. Retrieve hardware fingerprint
  const fingerprint = await getDeviceFingerprint();

  // 5. Build canonical representation for signing
  const canonicalString = JSON.stringify({
    id: event.id,
    event_type: event.event_type,
    tenant_id: event.tenant_id,
    occurred_at: event.occurred_at,
    payload: event.payload,
    deviceId: keys.deviceId,
    nonce,
    fingerprint
  });

  // 6. Sign the canonical payload
  const signature = await signPayload(canonicalString, keys.privateKey);

  // 7. Embed cryptographic payload details in event metadata
  event.metadata = {
    ...(event.metadata || {}),
    signature,
    nonce,
    fingerprint,
    deviceId: keys.deviceId,
    publicKeyJwk: keys.publicKeyJwk
  };

  return event;
}
