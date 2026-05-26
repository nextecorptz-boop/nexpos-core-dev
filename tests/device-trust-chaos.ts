// NEXPOS - Device Identity & Trust Chaos/Resilience Test Suite
// Run using: npx tsx tests/device-trust-chaos.ts

import 'fake-indexeddb/auto';
import { db } from '../lib/sync/db';
import { getOrCreateDeviceKeys } from '../lib/security/device-crypto';
import { getDeviceFingerprint } from '../lib/security/device-identity';
import { signEvent } from '../lib/security/payload-signing';
import { verifySignedEvent } from '../lib/security/trust-verifier';
import { validateCertificate, createSelfSignedCertificate } from '../lib/security/device-certificates';
import { registerPeer, updatePeerStatus } from '../lib/security/device-registry';
import { revokeDevice, quarantineDevice, suspectDevice } from '../lib/security/revocation-manager';
import { type DomainEvent } from '../lib/sync/commands';

async function runDeviceTrustChaosTests() {
  console.log('================================================================');
  console.log('   NEXPOS DEVICE TRUST CHAOS & RESILIENCE TESTING HARNESS      ');
  console.log('================================================================\n');

  try {
    // 1. Setup DB
    await db.open();
    console.log('✓ IndexedDB connection established successfully.');

    // Clear local stores
    await db.settings.clear();
    await db.device_certificates.clear();
    await db.device_trust_registry.clear();
    await db.telemetry_logs.clear();

    const tenantId = 'tenant-security-chaos';
    const branchId = 'branch-security-chaos';

    // ------------------------------------------------------------------
    // TEST 1: Keypair Generation & Fingerprinting
    // ------------------------------------------------------------------
    console.log('\n[TEST 1] Key Generation & Fingerprinting...');
    const keys = await getOrCreateDeviceKeys();
    console.log(`  - Device ID: ${keys.deviceId}`);
    console.log(`  - Public Key (JWK) kty: ${keys.publicKeyJwk.kty}`);
    if (keys.publicKeyJwk.crv !== 'P-256') {
      throw new Error('FAIL: Key curve must be P-256.');
    }
    
    // Check fingerprint
    const fingerprint = await getDeviceFingerprint();
    console.log(`  - Computed Fingerprint: ${fingerprint}`);
    if (!fingerprint || fingerprint.length !== 64) {
      throw new Error('FAIL: Fingerprint must be a valid SHA-256 hex string.');
    }
    console.log('✓ SUCCESS: Keypair and stable fingerprint generated successfully.');

    // ------------------------------------------------------------------
    // TEST 2: Canonical Payload Signing & Verification
    // ------------------------------------------------------------------
    console.log('\n[TEST 2] Payload Signing & Trust Verification...');
    const baseEvent: DomainEvent = {
      id: 'evt-sec-1001',
      tenant_id: tenantId,
      branch_id: branchId,
      aggregate_type: 'sale',
      aggregate_id: 'sale-sec-1',
      event_type: 'sale.created',
      event_version: 1,
      schema_version: 1,
      payload: { amount: 15000 },
      occurred_at: new Date().toISOString()
    };

    console.log('- Signing outbound event...');
    const signedEvent = await signEvent(baseEvent);
    console.log('  - Signature metadata attached.');
    
    console.log('- Verifying signed event...');
    const verification = await verifySignedEvent(signedEvent, true);
    console.log(`  - Verification result: verified = ${verification.verified}, reason = "${verification.reason || 'None'}"`);
    if (!verification.verified) {
      throw new Error(`FAIL: Valid signed event was rejected: ${verification.reason}`);
    }
    console.log('✓ SUCCESS: Event successfully signed and verified.');

    // ------------------------------------------------------------------
    // TEST 3: Tampering/Data Integrity Attack
    // ------------------------------------------------------------------
    console.log('\n[TEST 3] Cryptographic Tampering Attack...');
    
    // Clone event and modify payload data
    const tamperedEvent = JSON.parse(JSON.stringify(signedEvent));
    tamperedEvent.payload.amount = 999999; // Tampered total amount!

    console.log('- Verifying tampered event...');
    const tamperedCheck = await verifySignedEvent(tamperedEvent, true);
    console.log(`  - Tampered verification: verified = ${tamperedCheck.verified}, reason = "${tamperedCheck.reason}"`);
    if (tamperedCheck.verified) {
      throw new Error('FAIL: Tampered payload signature was incorrectly verified as valid!');
    }
    console.log('✓ SUCCESS: Tampered payload correctly identified and rejected.');

    // ------------------------------------------------------------------
    // TEST 4: Replay Attacks (Monotonic Nonce Check)
    // ------------------------------------------------------------------
    console.log('\n[TEST 4] Replay Attack Prevention...');
    
    const secondEvent: DomainEvent = {
      id: 'evt-sec-1002',
      tenant_id: tenantId,
      branch_id: branchId,
      aggregate_type: 'sale',
      aggregate_id: 'sale-sec-1',
      event_type: 'sale.item_added',
      event_version: 2,
      schema_version: 1,
      payload: { item_id: 'item-1', quantity: 1 },
      occurred_at: new Date().toISOString()
    };

    const signedEvent2 = await signEvent(secondEvent);
    
    // 1st time verification of Event 2 should pass
    console.log('- Verifying first replay...');
    const verifyFirst = await verifySignedEvent(signedEvent2, true);
    if (!verifyFirst.verified) {
      throw new Error(`FAIL: First verify of Event 2 failed: ${verifyFirst.reason}`);
    }

    // 2nd time verification of Event 2 (replay attack with identical nonce/metadata) should FAIL
    console.log('- Verifying duplicate replayed event...');
    const verifyReplay = await verifySignedEvent(signedEvent2, true);
    console.log(`  - Replay verification: verified = ${verifyReplay.verified}, reason = "${verifyReplay.reason}"`);
    if (verifyReplay.verified) {
      throw new Error('FAIL: Replayed event with reused nonce was accepted!');
    }
    console.log('✓ SUCCESS: Nonce replay attack blocked successfully.');

    // ------------------------------------------------------------------
    // TEST 5: Certificate Expiration & Offline Grace Periods
    // ------------------------------------------------------------------
    console.log('\n[TEST 5] Certificate Lifecycle & Grace Periods...');
    
    const fakePublicKeyJwk = keys.publicKeyJwk;

    // A. Active certificate: valid online and offline
    const activeCert = {
      deviceId: 'dev-grace-1',
      tenantId,
      publicKeyJwk: fakePublicKeyJwk,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(), // expires in 10 days
      status: 'active' as const,
      signature: 'signature-mock'
    };
    
    const checkActiveOnline = validateCertificate(activeCert, true);
    const checkActiveOffline = validateCertificate(activeCert, false);
    console.log(`  - Active online: valid = ${checkActiveOnline.valid}, warn = ${checkActiveOnline.warn}`);
    console.log(`  - Active offline: valid = ${checkActiveOffline.valid}, warn = ${checkActiveOffline.warn}`);
    if (!checkActiveOnline.valid || !checkActiveOffline.valid) {
      throw new Error('FAIL: Active certificate must be valid.');
    }

    // B. Expired but within offline grace period: invalid online, warning but valid offline
    const graceCert = {
      deviceId: 'dev-grace-2',
      tenantId,
      publicKeyJwk: fakePublicKeyJwk,
      issuedAt: new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(), // expired 10 days ago (within 30-day grace)
      status: 'active' as const,
      signature: 'signature-mock'
    };
    
    const checkGraceOnline = validateCertificate(graceCert, true);
    const checkGraceOffline = validateCertificate(graceCert, false);
    console.log(`  - Grace online: valid = ${checkGraceOnline.valid}, reason = "${checkGraceOnline.reason}"`);
    console.log(`  - Grace offline: valid = ${checkGraceOffline.valid}, warn = ${checkGraceOffline.warn}, reason = "${checkGraceOffline.reason}"`);
    
    if (checkGraceOnline.valid) {
      throw new Error('FAIL: Expired certificate should be invalid online.');
    }
    if (!checkGraceOffline.valid || !checkGraceOffline.warn) {
      throw new Error('FAIL: Expired certificate (within grace window) should be valid offline with a warning.');
    }

    // C. Expired beyond grace period: invalid online and offline
    const expiredCert = {
      deviceId: 'dev-grace-3',
      tenantId,
      publicKeyJwk: fakePublicKeyJwk,
      issuedAt: new Date(Date.now() - 240 * 24 * 3600 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(), // expired 40 days ago (beyond 30-day grace)
      status: 'active' as const,
      signature: 'signature-mock'
    };
    
    const checkExpiredOnline = validateCertificate(expiredCert, true);
    const checkExpiredOffline = validateCertificate(expiredCert, false);
    console.log(`  - Expired online: valid = ${checkExpiredOnline.valid}`);
    console.log(`  - Expired offline: valid = ${checkExpiredOffline.valid}`);
    if (checkExpiredOnline.valid || checkExpiredOffline.valid) {
      throw new Error('FAIL: Certificate expired beyond grace period must be hard-rejected.');
    }
    console.log('✓ SUCCESS: Certificate expiration and offline grace period logic verified.');

    // ------------------------------------------------------------------
    // TEST 6: Trust Registry States & Revocation Handling
    // ------------------------------------------------------------------
    console.log('\n[TEST 6] Trust Registry States & Revocation...');
    
    const peerDeviceId = 'peer-device-999';
    const peerJwk = keys.publicKeyJwk; // use same curve keys

    // A. Pending device
    const peerEvent: DomainEvent = {
      id: 'evt-peer-2001',
      tenant_id: tenantId,
      branch_id: branchId,
      aggregate_type: 'sale',
      aggregate_id: 'sale-sec-2',
      event_type: 'sale.created',
      event_version: 1,
      schema_version: 1,
      payload: { amount: 20000 },
      metadata: {
        signature: 'mock-sig',
        nonce: 10,
        fingerprint: 'peer-fingerprint',
        deviceId: peerDeviceId,
        publicKeyJwk: peerJwk
      },
      occurred_at: new Date().toISOString()
    };

    console.log('- Verifying unregistered peer (should auto-enroll as pending and fail verify)...');
    const verifyUnreg = await verifySignedEvent(peerEvent, true);
    console.log(`  - Unregistered verification: verified = ${verifyUnreg.verified}, reason = "${verifyUnreg.reason}"`);
    if (verifyUnreg.verified) {
      throw new Error('FAIL: Unregistered device should not be verified.');
    }
    
    // Check if peer is in registry as pending
    const registryEntry = await db.device_trust_registry.get(peerDeviceId);
    console.log(`  - Auto-registered registry status: "${registryEntry?.status}"`);
    if (registryEntry?.status !== 'pending') {
      throw new Error('FAIL: Device must be registered as pending.');
    }

    // B. Approved / Trusted peer
    console.log('- Setting peer trust status to trusted...');
    await updatePeerStatus(peerDeviceId, 'trusted');
    
    // Create actual signature for peer event to check cryptographic validation
    const peerNonce1 = 10;
    const peerFingerprint = 'peer-fingerprint';
    const peerCanonical1 = JSON.stringify({
      id: peerEvent.id,
      event_type: peerEvent.event_type,
      tenant_id: peerEvent.tenant_id,
      occurred_at: peerEvent.occurred_at,
      payload: peerEvent.payload,
      deviceId: peerDeviceId,
      nonce: peerNonce1,
      fingerprint: peerFingerprint
    });
    
    const { signPayload } = await import('../lib/security/device-crypto');
    const peerSignature1 = await signPayload(peerCanonical1, keys.privateKey);

    peerEvent.metadata = {
      signature: peerSignature1,
      nonce: peerNonce1,
      fingerprint: peerFingerprint,
      deviceId: peerDeviceId,
      publicKeyJwk: keys.publicKeyJwk
    };

    const verifyTrusted = await verifySignedEvent(peerEvent, true);
    console.log(`  - Trusted verification: verified = ${verifyTrusted.verified}`);
    if (!verifyTrusted.verified) {
      throw new Error(`FAIL: Trusted peer verification failed: ${verifyTrusted.reason}`);
    }

    // C. Administrative Revocation
    console.log('- Revoking peer device...');
    await revokeDevice(peerDeviceId, 'Administrative security revoke');
    
    // Use new nonce to avoid replay check failing first
    const peerNonce2 = 11;
    const peerCanonical2 = JSON.stringify({
      id: peerEvent.id,
      event_type: peerEvent.event_type,
      tenant_id: peerEvent.tenant_id,
      occurred_at: peerEvent.occurred_at,
      payload: peerEvent.payload,
      deviceId: peerDeviceId,
      nonce: peerNonce2,
      fingerprint: peerFingerprint
    });
    peerEvent.metadata.signature = await signPayload(peerCanonical2, keys.privateKey);
    peerEvent.metadata.nonce = peerNonce2;

    const verifyRevoked = await verifySignedEvent(peerEvent, true);
    console.log(`  - Revoked verification: verified = ${verifyRevoked.verified}, reason = "${verifyRevoked.reason}"`);
    if (verifyRevoked.verified || verifyRevoked.reason !== 'Peer device trust status: revoked') {
      throw new Error(`FAIL: Revoked device events should be rejected with status reason. Got verified=${verifyRevoked.verified}, reason=${verifyRevoked.reason}`);
    }

    // D. Quarantine & Suspect states
    console.log('- Quarantining peer device...');
    await quarantineDevice(peerDeviceId, 'Suspicious network burst activity');
    
    const peerNonce3 = 12;
    const peerCanonical3 = JSON.stringify({
      id: peerEvent.id,
      event_type: peerEvent.event_type,
      tenant_id: peerEvent.tenant_id,
      occurred_at: peerEvent.occurred_at,
      payload: peerEvent.payload,
      deviceId: peerDeviceId,
      nonce: peerNonce3,
      fingerprint: peerFingerprint
    });
    peerEvent.metadata.signature = await signPayload(peerCanonical3, keys.privateKey);
    peerEvent.metadata.nonce = peerNonce3;

    const verifyQuarantined = await verifySignedEvent(peerEvent, true);
    console.log(`  - Quarantined verification: verified = ${verifyQuarantined.verified}, reason = "${verifyQuarantined.reason}"`);
    if (verifyQuarantined.verified || verifyQuarantined.reason !== 'Peer device trust status: quarantined') {
      throw new Error(`FAIL: Quarantined device events should be rejected with status reason.`);
    }

    console.log('- Suspending (suspected) peer device...');
    await suspectDevice(peerDeviceId, 'Offline timeline divergence');
    
    const peerNonce4 = 13;
    const peerCanonical4 = JSON.stringify({
      id: peerEvent.id,
      event_type: peerEvent.event_type,
      tenant_id: peerEvent.tenant_id,
      occurred_at: peerEvent.occurred_at,
      payload: peerEvent.payload,
      deviceId: peerDeviceId,
      nonce: peerNonce4,
      fingerprint: peerFingerprint
    });
    peerEvent.metadata.signature = await signPayload(peerCanonical4, keys.privateKey);
    peerEvent.metadata.nonce = peerNonce4;

    const verifySuspected = await verifySignedEvent(peerEvent, true);
    console.log(`  - Suspected verification: verified = ${verifySuspected.verified}, reason = "${verifySuspected.reason}"`);
    if (verifySuspected.verified || verifySuspected.reason !== 'Peer device trust status: suspected') {
      throw new Error(`FAIL: Suspected device events should be rejected with status reason.`);
    }

    console.log('✓ SUCCESS: Trust registry state machine and revocation checks verified.');

    console.log('\n================================================================');
    console.log('   ALL DEVICE TRUST CHAOS TESTS PASSED SUCCESSFULLY! (100% OK)  ');
    console.log('================================================================');
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ DEVICE TRUST CHAOS TESTING FAILED:');
    console.error(err.message || err);
    process.exit(1);
  }
}

runDeviceTrustChaosTests();
