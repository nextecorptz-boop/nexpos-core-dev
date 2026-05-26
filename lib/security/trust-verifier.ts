import { db } from '@/lib/sync/db';
import { type DomainEvent } from '@/lib/sync/commands';
import { verifyPayload } from './device-crypto';
import { getPeerTrustEntry, registerPeer, updatePeerNonce } from './device-registry';
import { getLocalCertificate, validateCertificate } from './device-certificates';
import { Telemetry } from '@/lib/telemetry/telemetry';

export interface VerificationResult {
  verified: boolean;
  reason?: string;
}

/**
 * Verifies the cryptographic signature of a DomainEvent payload.
 * Validates the device's trust state, checks expiration, and guards
 * against replay attacks using a monotonic sequence nonce check.
 */
export async function verifySignedEvent(
  event: DomainEvent,
  isOnline: boolean = true
): Promise<VerificationResult> {
  const metadata = event.metadata;

  if (!metadata || !metadata.signature || metadata.nonce === undefined || !metadata.deviceId || !metadata.publicKeyJwk) {
    return { verified: false, reason: 'Missing cryptographic trust metadata.' };
  }

  const { signature, nonce, fingerprint, deviceId, publicKeyJwk } = metadata;

  if (!db.isOpen()) {
    await db.open();
  }

  // 1. Resolve local device ID to check if it's a self-generated event
  const localDeviceIdSetting = await db.settings.get('device_id');
  let localDeviceId = localDeviceIdSetting?.value;
  if (!localDeviceId && typeof window === 'undefined') {
    localDeviceId = 'server-side';
  }

  if (deviceId === localDeviceId) {
    // A. Verify self-signed local event
    const cert = await getLocalCertificate(deviceId);
    if (!cert) {
      return { verified: false, reason: 'Local device certificate not found.' };
    }

    const certCheck = validateCertificate(cert, isOnline);
    if (!certCheck.valid) {
      const daysLeft = (new Date(cert.expiresAt).getTime() - Date.now()) / (1000 * 3600 * 24);
      await Telemetry.trackCertificateExpiration(deviceId, cert.expiresAt, daysLeft);
      return { verified: false, reason: `Local certificate invalid: ${certCheck.reason}` };
    }

    // Verify self-nonce
    const selfNonceSetting = await db.settings.get('device_last_verified_nonce');
    const lastNonce = selfNonceSetting ? Number(selfNonceSetting.value) : 0;
    if (nonce <= lastNonce) {
      await Telemetry.trackReplayAttempt(deviceId, event.id, nonce, lastNonce);
      return { verified: false, reason: `Replay check failed: nonce ${nonce} has already been processed.` };
    }

    // Canonical verify
    const canonicalString = JSON.stringify({
      id: event.id,
      event_type: event.event_type,
      tenant_id: event.tenant_id,
      occurred_at: event.occurred_at,
      payload: event.payload,
      deviceId,
      nonce,
      fingerprint
    });

    const isSigValid = await verifyPayload(canonicalString, signature, publicKeyJwk);
    if (!isSigValid) {
      await Telemetry.trackSignatureFailure(deviceId, event.id, 'Local signature verification failed');
      return { verified: false, reason: 'Cryptographic signature is invalid.' };
    }

    // Update self verified nonce
    await db.settings.put({ key: 'device_last_verified_nonce', value: nonce });
    return { verified: true };

  } else {
    // B. Verify peer event
    let peer = await getPeerTrustEntry(deviceId);

    if (!peer) {
      // Self-register new peer as pending approval
      peer = {
        deviceId,
        tenantId: event.tenant_id,
        publicKeyJwk,
        status: 'pending',
        lastSeen: new Date().toISOString(),
        lastNonce: 0
      };
      await registerPeer(peer);
      await Telemetry.warn('security', `New peer device registered. Awaiting administrative approval.`, { deviceId });
      return { verified: false, reason: 'Device is pending administrative approval.' };
    }

    // Check trust state
    if (peer.status !== 'trusted') {
      return { verified: false, reason: `Peer device trust status: ${peer.status}` };
    }

    // Replay Nonce protection
    const lastNonce = peer.lastNonce || 0;
    if (nonce <= lastNonce) {
      await Telemetry.trackReplayAttempt(deviceId, event.id, nonce, lastNonce);
      return { verified: false, reason: `Replay check failed: nonce ${nonce} has already been processed.` };
    }

    // Verify cryptographic signature
    const canonicalString = JSON.stringify({
      id: event.id,
      event_type: event.event_type,
      tenant_id: event.tenant_id,
      occurred_at: event.occurred_at,
      payload: event.payload,
      deviceId,
      nonce,
      fingerprint
    });

    const isSigValid = await verifyPayload(canonicalString, signature, publicKeyJwk);
    if (!isSigValid) {
      await Telemetry.trackSignatureFailure(deviceId, event.id, 'Peer signature verification failed');
      return { verified: false, reason: 'Cryptographic signature is invalid.' };
    }

    // Update peer registry details
    await updatePeerNonce(deviceId, nonce);
    return { verified: true };
  }
}
