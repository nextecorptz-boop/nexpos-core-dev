// NEXPOS - Event Chaos & Resilience Test Suite
// Run using: npx tsx tests/event-chaos.ts

import 'fake-indexeddb/auto';
import { db } from '../lib/sync/db';
import { ConflictResolutionEngine } from '../lib/sync/conflict-resolution';
import { ProjectionManager, calculateSnapshotChecksum } from '../lib/sync/projections';
import { LedgerAuditor } from '../lib/sync/ledger-auditor';
import { type DomainEvent } from '../lib/sync/commands';

async function runEventChaosTests() {
  console.log('================================================================');
  console.log('   NEXPOS EVENT CHAOS & RESILIENCE TESTING HARNESS             ');
  console.log('================================================================\n');

  try {
    // 1. Setup DB
    await db.open();
    console.log('✓ IndexedDB Connection established successfully.');

    // Clear local stores
    await db.variants.clear();
    await db.settings.clear();
    await db.telemetry_logs.clear();
    await db.quarantined_mutations.clear();

    const tenantId = 'tenant-a-chaos';
    const branchId = 'branch-1-chaos';
    const variantId = 'variant-shoe-123';

    // Seed initial variant
    await db.variants.put({
      id: variantId,
      tenant_id: tenantId,
      branch_id: branchId,
      name: 'Superstar Run V1',
      sku: 'SKU-SUP-123',
      price: 150000,
      cost_price: 90000,
      quantity: 10, // starts with 10 items
      updated_at: new Date().toISOString()
    });

    // ------------------------------------------------------------------
    // TEST 1: Replay Deduplication Storm Protection
    // ------------------------------------------------------------------
    console.log('\n[TEST 1] Testing Replay Deduplication Storms...');
    
    const eventId = 'evt-unique-1001';
    const baseEvent: DomainEvent = {
      id: eventId,
      tenant_id: tenantId,
      branch_id: branchId,
      aggregate_type: 'sale',
      aggregate_id: 'sale-999',
      event_type: 'sale.item_added',
      event_version: 1,
      schema_version: 1,
      payload: { variant_id: variantId, quantity: 2 },
      occurred_at: new Date().toISOString()
    };

    // First resolution should project the event
    console.log('- Resolving original event...');
    const res1 = await ConflictResolutionEngine.resolve(baseEvent);
    console.log(`  - First resolve result: action = ${res1.action}`);
    if (res1.action !== 'project') {
      throw new Error('FAIL: First event should have resolved to project.');
    }
    
    // Project the event
    await ProjectionManager.projectEvent(baseEvent);
    console.log(`  - Variant quantity after first event projection: ${(await db.variants.get(variantId))?.quantity}`);

    // Second resolution of the SAME event (deduplication storm)
    console.log('- Resolving identical duplicate event (dedup storm)...');
    const res2 = await ConflictResolutionEngine.resolve(baseEvent);
    console.log(`  - Duplicate resolve result: action = ${res2.action}, reason = "${res2.reason}"`);
    if (res2.action !== 'suppress') {
      throw new Error('FAIL: Duplicate event should have been suppressed.');
    }
    console.log('✓ SUCCESS: Deduplication storm correctly identified and suppressed.');

    // ------------------------------------------------------------------
    // TEST 2: Out-Of-Order Delivery & Sequence Gaps
    // ------------------------------------------------------------------
    console.log('\n[TEST 2] Testing Out-Of-Order Delivery (Gaps)...');

    const gapEvent: DomainEvent = {
      id: 'evt-gap-1002',
      tenant_id: tenantId,
      branch_id: branchId,
      aggregate_type: 'sale',
      aggregate_id: 'sale-999', // same aggregate stream
      event_type: 'sale.item_added',
      event_version: 3, // Version 2 was skipped! (current setting for sale-999 is 1)
      schema_version: 1,
      payload: { variant_id: variantId, quantity: 1 },
      occurred_at: new Date().toISOString()
    };

    console.log('- Resolving event with version gap (version 3 when version 1 was last)...');
    const res3 = await ConflictResolutionEngine.resolve(gapEvent);
    console.log(`  - Gap resolve result: action = ${res3.action}, reason = "${res3.reason}"`);
    if (res3.action !== 'quarantine') {
      throw new Error('FAIL: Gapped event should have been quarantined.');
    }
    console.log('✓ SUCCESS: Sequence gap detected and quarantined correctly.');

    // ------------------------------------------------------------------
    // TEST 3: Business Invariant Protections
    // ------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Business Invariant Violations...');

    // A. Negative Stock Guard
    const overdrawEvent: DomainEvent = {
      id: 'evt-overdraw-1003',
      tenant_id: tenantId,
      branch_id: branchId,
      aggregate_type: 'sale',
      aggregate_id: 'sale-1000',
      event_type: 'sale.item_added',
      event_version: 1,
      schema_version: 1,
      payload: { variant_id: variantId, quantity: 50 }, // Requests 50 items but only 8 left (10 - 2 from Test 1)
      occurred_at: new Date().toISOString()
    };

    console.log('- Resolving event that triggers negative stock...');
    const res4 = await ConflictResolutionEngine.resolve(overdrawEvent);
    console.log(`  - Overdraw resolve result: action = ${res4.action}, reason = "${res4.reason}"`);
    if (res4.action !== 'quarantine') {
      throw new Error('FAIL: Negative stock event should have been quarantined.');
    }
    console.log('✓ SUCCESS: Negative stock guard triggered and quarantined the event.');

    // B. Cash Session closed twice
    const sessionId = 'session-till-xyz';
    const closeSessionEvent1: DomainEvent = {
      id: 'evt-session-close-1',
      tenant_id: tenantId,
      branch_id: branchId,
      aggregate_type: 'cash_session',
      aggregate_id: sessionId,
      event_type: 'cash_session.closed',
      event_version: 1,
      schema_version: 1,
      payload: { closing_float: 50000, expected_cash: 50000 },
      occurred_at: new Date().toISOString()
    };

    console.log('- Closing cash session first time...');
    const closeRes1 = await ConflictResolutionEngine.resolve(closeSessionEvent1);
    if (closeRes1.action !== 'project') {
      throw new Error('FAIL: First close session should be allowed.');
    }
    await ProjectionManager.projectEvent(closeSessionEvent1);

    const closeSessionEvent2: DomainEvent = {
      id: 'evt-session-close-2',
      tenant_id: tenantId,
      branch_id: branchId,
      aggregate_type: 'cash_session',
      aggregate_id: sessionId,
      event_type: 'cash_session.closed',
      event_version: 2,
      schema_version: 1,
      payload: { closing_float: 50000, expected_cash: 50000 },
      occurred_at: new Date().toISOString()
    };

    console.log('- Closing cash session second time (double close)...');
    const closeRes2 = await ConflictResolutionEngine.resolve(closeSessionEvent2);
    console.log(`  - Double close resolve result: action = ${closeRes2.action}, reason = "${closeRes2.reason}"`);
    if (closeRes2.action !== 'quarantine') {
      throw new Error('FAIL: Double close session event should have been quarantined.');
    }
    console.log('✓ SUCCESS: Cash session closed-once-only invariant protected.');

    // ------------------------------------------------------------------
    // TEST 4: Snapshot Corruption Detection
    // ------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Snapshot Corruption...');

    const validSnapshotData = {
      variants: [
        {
          id: variantId,
          tenant_id: tenantId,
          branch_id: branchId,
          name: 'Superstar Run V1',
          sku: 'SKU-SUP-123',
          price: 150000,
          cost_price: 90000,
          quantity: 25,
          updated_at: new Date().toISOString()
        }
      ]
    };

    const validChecksum = await calculateSnapshotChecksum(validSnapshotData);
    const corruptedSnapshot = {
      last_event_position: 10,
      last_event_version: 1,
      snapshot_checksum: 'CORRUPTED_HASH_VALUE_9999',
      data: validSnapshotData
    };

    console.log('- Attempting fast replay with corrupted snapshot checksum...');
    try {
      await ProjectionManager.executeFastReplay(corruptedSnapshot, []);
      throw new Error('FAIL: executeFastReplay should have thrown checksum verification error.');
    } catch (e: any) {
      console.log(`  - Checksum validation failure output as expected: "${e.message}"`);
      if (!e.message.includes('checksum validation failed')) {
        throw new Error(`FAIL: Unexpected error message: ${e.message}`);
      }
    }

    const cleanSnapshot = {
      last_event_position: 10,
      last_event_version: 1,
      snapshot_checksum: validChecksum,
      data: validSnapshotData
    };

    console.log('- Attempting fast replay with valid snapshot checksum...');
    await ProjectionManager.executeFastReplay(cleanSnapshot, []);
    const restoredVariant = await db.variants.get(variantId);
    console.log(`  - Replayed quantity from snapshot: ${restoredVariant?.quantity}`);
    if (restoredVariant?.quantity !== 25) {
      throw new Error('FAIL: Variant quantity was not correctly restored from snapshot.');
    }
    console.log('✓ SUCCESS: Snapshot checksum corruption successfully caught, clean snapshots restore perfectly.');

    // ------------------------------------------------------------------
    // TEST 5: Ledger Auditor Consistency & Drift Checks
    // ------------------------------------------------------------------
    console.log('\n[TEST 5] Testing Ledger Auditor & Projection Drift detection...');

    // Create a stream history
    const streamHistory: DomainEvent[] = [
      {
        id: 'evt-hist-1',
        tenant_id: tenantId,
        branch_id: branchId,
        aggregate_type: 'variant',
        aggregate_id: variantId,
        event_type: 'stock.adjusted',
        event_version: 1,
        schema_version: 1,
        payload: { variant_id: variantId, quantity: 10 },
        occurred_at: new Date().toISOString()
      },
      {
        id: 'evt-hist-2',
        tenant_id: tenantId,
        branch_id: branchId,
        aggregate_type: 'variant',
        aggregate_id: variantId,
        event_type: 'sale.item_added',
        event_version: 2,
        schema_version: 1,
        payload: { variant_id: variantId, quantity: 3 },
        occurred_at: new Date().toISOString()
      }
    ];

    console.log('- Running auditor on clean histories matching database...');
    // Clear and project events to align DB
    await db.variants.put({
      id: variantId,
      tenant_id: tenantId,
      branch_id: branchId,
      name: 'Superstar Run V1',
      sku: 'SKU-SUP-123',
      price: 150000,
      cost_price: 90000,
      quantity: 7, // 0 + 10 - 3 = 7
      updated_at: new Date().toISOString()
    });

    let auditReport = await LedgerAuditor.auditLocalLedger(streamHistory);
    console.log(`  - Auditor passed = ${auditReport.passed}, drifts = ${auditReport.driftsCount}, missing = ${auditReport.missingEventsCount}`);
    if (!auditReport.passed) {
      throw new Error('FAIL: Auditor should have passed clean ledger.');
    }

    console.log('- Introducing artificial state drift in variants table...');
    await db.variants.update(variantId, { quantity: 15 }); // Mismatch! Ledger says 7, Active DB has 15.

    auditReport = await LedgerAuditor.auditLocalLedger(streamHistory);
    console.log(`  - Auditor after drift: passed = ${auditReport.passed}, drifts = ${auditReport.driftsCount}`);
    if (auditReport.passed || auditReport.driftsCount !== 1) {
      throw new Error('FAIL: Auditor failed to capture state drift.');
    }
    console.log(`  - Drift detail: "${auditReport.details[0]}"`);

    console.log('- Introducing sequence gap in event stream history...');
    const streamHistoryWithGap: DomainEvent[] = [
      streamHistory[0],
      {
        id: 'evt-hist-3',
        tenant_id: tenantId,
        branch_id: branchId,
        aggregate_type: 'variant',
        aggregate_id: variantId,
        event_type: 'sale.item_added',
        event_version: 3, // skipped version 2!
        schema_version: 1,
        payload: { variant_id: variantId, quantity: 1 },
        occurred_at: new Date().toISOString()
      }
    ];

    auditReport = await LedgerAuditor.auditLocalLedger(streamHistoryWithGap);
    console.log(`  - Auditor after sequence gap: passed = ${auditReport.passed}, missing gaps = ${auditReport.missingEventsCount}`);
    if (auditReport.passed || auditReport.missingEventsCount !== 1) {
      throw new Error('FAIL: Auditor failed to capture event version sequence gap.');
    }
    console.log(`  - Sequence gap detail: "${auditReport.details[0]}"`);
    console.log('✓ SUCCESS: Ledger auditor captures projection drift and sequence gaps flawlessly.');

    console.log('\n================================================================');
    console.log('   ALL EVENT CHAOS TESTS PASSED SUCCESSFULLY! (100% OK)         ');
    console.log('================================================================');
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ EVENT CHAOS TESTING FAILED:');
    console.error(err.message || err);
    process.exit(1);
  }
}

runEventChaosTests();
