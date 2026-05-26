// NEXPOS - Device Cryptography Performance & SLA Benchmarking Suite
// Run using: npx tsx tests/device-signature-benchmark.ts

import 'fake-indexeddb/auto';
import { db } from '../lib/sync/db';
import { getOrCreateDeviceKeys, signPayload, verifyPayload } from '../lib/security/device-crypto';

async function runDeviceSignatureBenchmark() {
  console.log('================================================================');
  console.log('   NEXPOS DEVICE TRUST CRYPTO BENCHMARK & SLA AUDIT             ');
  console.log('================================================================\n');

  try {
    // 1. Setup DB
    await db.open();
    await db.settings.clear();

    const keys = await getOrCreateDeviceKeys();
    const ITERATIONS = 1000;
    const testPayloads: string[] = [];

    // Pre-generate random payloads
    for (let i = 0; i < ITERATIONS; i++) {
      testPayloads.push(JSON.stringify({
        id: `evt-${i}-${crypto.randomUUID()}`,
        event_type: 'sale.item_added',
        tenant_id: 'tenant-a',
        occurred_at: new Date().toISOString(),
        payload: { item_id: `item-${i}`, quantity: (i % 5) + 1, price: 15000 },
        deviceId: keys.deviceId,
        nonce: i + 1,
        fingerprint: 'mock-fingerprint-for-performance-testing-hash-value-12345'
      }));
    }

    console.log(`Starting execution of ${ITERATIONS} cryptographic operations...`);

    // ------------------------------------------------------------------
    // BENCHMARK 1: Payload Signature Generation
    // ------------------------------------------------------------------
    const signatures: string[] = [];
    const signStart = performance.now();
    
    for (let i = 0; i < ITERATIONS; i++) {
      const sig = await signPayload(testPayloads[i], keys.privateKey);
      signatures.push(sig);
    }

    const signDurationMs = performance.now() - signStart;
    const avgSignLatencyMs = signDurationMs / ITERATIONS;
    const signThroughput = Math.round(ITERATIONS / (signDurationMs / 1000));

    // ------------------------------------------------------------------
    // BENCHMARK 2: Payload Signature Verification
    // ------------------------------------------------------------------
    const verifyStart = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      const isValid = await verifyPayload(testPayloads[i], signatures[i], keys.publicKeyJwk);
      if (!isValid) {
        throw new Error(`FAIL: Verification failed at index ${i}`);
      }
    }

    const verifyDurationMs = performance.now() - verifyStart;
    const avgVerifyLatencyMs = verifyDurationMs / ITERATIONS;
    const verifyThroughput = Math.round(ITERATIONS / (verifyDurationMs / 1000));

    // ------------------------------------------------------------------
    // SLA AUDIT & REPORT GENERATION
    // ------------------------------------------------------------------
    const signSlaPassed = avgSignLatencyMs < 5.0;
    const verifySlaPassed = avgVerifyLatencyMs < 5.0;

    console.log('\n=======================================');
    console.log('   NEXPOS CRYPTO BENCHMARK SUMMARY      ');
    console.log('=======================================');
    console.log(`- Iterations:             ${ITERATIONS} trials`);
    console.log(`- Sign Payload Latency:   ${avgSignLatencyMs.toFixed(3)} ms per signature (SLA < 5ms)`);
    console.log(`  - Sign SLA Status:      ${signSlaPassed ? 'PASS (EXCELLENT)' : 'FAIL (HIGH OVERHEAD)'}`);
    console.log(`  - Sign Throughput:      ${signThroughput} ops/sec`);
    console.log(`- Verify Payload Latency: ${avgVerifyLatencyMs.toFixed(3)} ms per verify (SLA < 5ms)`);
    console.log(`  - Verify SLA Status:    ${verifySlaPassed ? 'PASS (EXCELLENT)' : 'FAIL (HIGH OVERHEAD)'}`);
    console.log(`  - Verify Throughput:    ${verifyThroughput} ops/sec`);
    console.log('=======================================\n');

    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ SIGNATURE BENCHMARK RUN FAILED:');
    console.error(err.message || err);
    process.exit(1);
  }
}

runDeviceSignatureBenchmark();
