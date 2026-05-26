import { db, type DeviceCertificate } from '@/lib/sync/db';
import { signPayload, verifyPayload } from './device-crypto';

// Constants
export const CERT_VALIDITY_DAYS = 180;
export const CERT_WARN_THRESHOLD_DAYS = 30;
export const CERT_OFFLINE_GRACE_PERIOD_DAYS = 30; // 30 days offline grace period before hard fail

/**
 * Checks if a certificate is valid.
 */
export function validateCertificate(
  cert: DeviceCertificate,
  isOnline: boolean = true
): { valid: boolean; warn: boolean; reason?: string } {
  if (cert.status === 'revoked') {
    return { valid: false, warn: false, reason: 'Certificate has been revoked.' };
  }
  if (cert.status === 'rotated') {
    return { valid: false, warn: false, reason: 'Certificate has been rotated.' };
  }

  const now = new Date();
  const expiresAt = new Date(cert.expiresAt);
  const issuedAt = new Date(cert.issuedAt);

  if (now < issuedAt) {
    return { valid: false, warn: false, reason: 'Certificate is not active yet.' };
  }

  if (now > expiresAt) {
    if (!isOnline) {
      // Graceful offline handling: allow a grace period to avoid hard-failing retail operations
      const graceDeadline = new Date(expiresAt.getTime() + CERT_OFFLINE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      if (now <= graceDeadline) {
        return {
          valid: true,
          warn: true,
          reason: `Certificate expired on ${expiresAt.toLocaleDateString()}, operating under offline grace period.`
        };
      }
    }
    return { valid: false, warn: false, reason: 'Certificate has expired.' };
  }

  // Check 30-day warning threshold
  const warningDeadline = new Date(expiresAt.getTime() - CERT_WARN_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  if (now >= warningDeadline) {
    return { valid: true, warn: true, reason: `Certificate will expire soon on ${expiresAt.toLocaleDateString()}.` };
  }

  return { valid: true, warn: false };
}

/**
 * Retrieves the local device's active certificate from IndexedDB.
 */
export async function getLocalCertificate(deviceId: string): Promise<DeviceCertificate | null> {
  if (!db.isOpen()) {
    await db.open();
  }
  const cert = await db.device_certificates.get(deviceId);
  return cert || null;
}

/**
 * Saves the local device's certificate to IndexedDB.
 */
export async function saveLocalCertificate(cert: DeviceCertificate): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
  await db.device_certificates.put(cert);
}

/**
 * Generates a self-signed certificate, typically used for registration requests.
 */
export async function createSelfSignedCertificate(
  deviceId: string,
  tenantId: string,
  publicKeyJwk: JsonWebKey,
  privateKey: CryptoKey
): Promise<DeviceCertificate> {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + CERT_VALIDITY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const certData = {
    deviceId,
    tenantId,
    publicKeyJwk,
    issuedAt,
    expiresAt
  };

  const certString = JSON.stringify(certData);
  const signature = await signPayload(certString, privateKey);

  return {
    ...certData,
    status: 'active',
    signature
  };
}

/**
 * Verifies a certificate signature. For self-signed certs, validates against its own public key.
 */
export async function verifyCertificateSignature(cert: DeviceCertificate): Promise<boolean> {
  const certData = {
    deviceId: cert.deviceId,
    tenantId: cert.tenantId,
    publicKeyJwk: cert.publicKeyJwk,
    issuedAt: cert.issuedAt,
    expiresAt: cert.expiresAt
  };
  const certString = JSON.stringify(certData);
  return verifyPayload(certString, cert.signature, cert.publicKeyJwk);
}
