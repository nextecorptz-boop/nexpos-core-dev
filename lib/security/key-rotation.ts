import { db, type DeviceCertificate } from '@/lib/sync/db';
import { generateDeviceKeyPair, getOrCreateDeviceKeys, subtleCrypto } from './device-crypto';
import { createSelfSignedCertificate, saveLocalCertificate } from './device-certificates';
import { Telemetry } from '@/lib/telemetry/telemetry';

/**
 * Executes a local key rotation.
 * Generates a new ECDSA P-256 keypair, marks the old certificate as rotated,
 * stores the new keys, and creates/saves the new active certificate.
 */
export async function rotateDeviceKeys(tenantId: string): Promise<DeviceCertificate> {
  if (!db.isOpen()) {
    await db.open();
  }

  // 1. Get current keys & info to find device ID
  const oldKeyInfo = await getOrCreateDeviceKeys();
  const deviceId = oldKeyInfo.deviceId;

  // 2. Mark any existing certificate as rotated
  const oldCert = await db.device_certificates.get(deviceId);
  if (oldCert) {
    oldCert.status = 'rotated';
    await db.device_certificates.put(oldCert);
  }

  // 3. Generate new keypair
  const newKeyPair = await generateDeviceKeyPair();
  const newPublicKeyJwk = await subtleCrypto.exportKey('jwk', newKeyPair.publicKey);

  // 4. Save new keys to db.settings (overwrites old keys)
  await db.settings.put({ key: 'device_private_key', value: newKeyPair.privateKey });
  await db.settings.put({ key: 'device_public_key', value: newKeyPair.publicKey });
  await db.settings.put({ key: 'device_public_key_jwk', value: newPublicKeyJwk });

  // Reset the signature nonce for the new key (optional but good practice,
  // though nonce is typically monotonic, starting new key session at 1 is standard
  // since a new key pair has its own signature context).
  await db.settings.put({ key: 'device_signature_nonce', value: 1 });

  // 5. Create new certificate
  const newCert = await createSelfSignedCertificate(
    deviceId,
    tenantId,
    newPublicKeyJwk,
    newKeyPair.privateKey
  );

  // 6. Save the new certificate
  await saveLocalCertificate(newCert);

  // 7. Track telemetry
  await Telemetry.info('security', `Cryptographic key rotation completed successfully.`, {
    deviceId,
    tenantId,
    issuedAt: newCert.issuedAt,
    expiresAt: newCert.expiresAt
  });

  return newCert;
}
