import { db, type LocalVariant, type LocalTransfer } from './db';
import { type DomainEvent } from './commands';
import { Telemetry } from '../telemetry/telemetry';

export const PROJECTION_VERSION = 1;
export const PROJECTION_CHECKSUM = 'PROJ_HASH_V1_4E9A3C2B';

export class ProjectionManager {
  /**
   * Apply a single event to project its state onto active IndexedDB tables
   */
  static async projectEvent(event: DomainEvent): Promise<void> {
    await db.transaction('rw', [db.variants, db.transfers, db.settings], async () => {
      switch (event.event_type) {
        case 'sale.item_added': {
          const { variant_id, quantity } = event.payload;
          const variant = await db.variants.get(variant_id);
          if (variant) {
            variant.quantity = Math.max(0, variant.quantity - quantity);
            variant.updated_at = event.occurred_at;
            await db.variants.put(variant);
          }
          break;
        }

        case 'stock.adjusted': {
          const { variant_id, quantity } = event.payload;
          const variant = await db.variants.get(variant_id);
          if (variant) {
            variant.quantity = Math.max(0, variant.quantity + quantity);
            variant.updated_at = event.occurred_at;
            await db.variants.put(variant);
          }
          break;
        }

        case 'transfer.dispatched': {
          const transferId = event.aggregate_id;
          const { from_branch_id, to_branch_id, items } = event.payload;

          const newTransfer: LocalTransfer = {
            id: transferId,
            tenant_id: event.tenant_id,
            from_branch_id,
            to_branch_id,
            status: 'dispatched',
            items,
            updated_at: event.occurred_at
          };
          await db.transfers.put(newTransfer);

          // Deduct from source branch stock levels
          for (const item of items) {
            const variant = await db.variants.get(item.variant_id);
            if (variant && variant.branch_id === from_branch_id) {
              variant.quantity = Math.max(0, variant.quantity - item.quantity);
              await db.variants.put(variant);
            }
          }
          break;
        }

        case 'transfer.received': {
          const transferId = event.aggregate_id;
          const transfer = await db.transfers.get(transferId);
          if (transfer) {
            transfer.status = 'received';
            transfer.updated_at = event.occurred_at;
            await db.transfers.put(transfer);

            // Add to destination branch stock
            for (const item of transfer.items) {
              const variant = await db.variants.get(item.variant_id);
              if (variant && variant.branch_id === transfer.to_branch_id) {
                variant.quantity += item.received_qty || item.quantity;
                await db.variants.put(variant);
              }
            }
          }
          break;
        }

        case 'cash_session.closed': {
          const sessionId = event.aggregate_id;
          await db.settings.put({ key: `session_closed_${sessionId}`, value: 'true' });
          break;
        }
      }
    });
  }

  /**
   * REPLAY MODE: Full Replay
   * Wipes active store tables and processes all events in sequence
   */
  static async executeFullReplay(events: DomainEvent[]): Promise<void> {
    const start = performance.now();
    await Telemetry.info('sync', 'Starting full cold rebuild of state projections...');

    // Shadow Table strategy: rebuild on a shadow memory copy and write atomically
    const shadowVariants: Map<string, LocalVariant> = new Map();
    const shadowTransfers: Map<string, LocalTransfer> = new Map();

    // 1. Prime shadow tables from current base settings (excluding transactional counts)
    const baseVariants = await db.variants.toArray();
    baseVariants.forEach(v => {
      shadowVariants.set(v.id, { ...v, quantity: 0 }); // Zero counts for full replay recalculation
    });

    // 2. Play events sequentially in-memory
    events.sort((a, b) => (a.occurred_at > b.occurred_at ? 1 : -1));

    for (const event of events) {
      if (event.event_type === 'sale.item_added') {
        const { variant_id, quantity } = event.payload;
        const variant = shadowVariants.get(variant_id);
        if (variant) {
          variant.quantity = Math.max(0, variant.quantity - quantity);
          variant.updated_at = event.occurred_at;
        }
      } else if (event.event_type === 'stock.adjusted') {
        const { variant_id, quantity } = event.payload;
        const variant = shadowVariants.get(variant_id);
        if (variant) {
          variant.quantity = Math.max(0, variant.quantity + quantity);
          variant.updated_at = event.occurred_at;
        }
      }
    }

    // 3. Swap Shadow and Production datasets atomically in transaction
    await db.transaction('rw', [db.variants, db.transfers, db.settings], async () => {
      await db.variants.clear();
      const finalVariants = Array.from(shadowVariants.values());
      await db.variants.bulkAdd(finalVariants);

      // Save projection checksum and details
      await db.settings.put({ key: 'projection_version', value: PROJECTION_VERSION });
      await db.settings.put({ key: 'projection_checksum', value: PROJECTION_CHECKSUM });
      await db.settings.put({ key: 'projections_rebuilt_at', value: new Date().toISOString() });
    });

    const elapsed = performance.now() - start;
    await Telemetry.info('sync', `Full projection rebuild completed in ${elapsed.toFixed(1)}ms. Version alignment: ${PROJECTION_VERSION}`);
  }

  /**
   * REPLAY MODE: Fast Replay
   * Restores state using the nearest snapshot watermark checkpoint
   */
  static async executeFastReplay(snapshot: any, subsequentEvents: DomainEvent[]): Promise<void> {
    // 1. Checksum validation for security and drift prevention
    if (snapshot && snapshot.snapshot_checksum) {
      const calculated = await calculateSnapshotChecksum(snapshot.data);
      if (calculated !== snapshot.snapshot_checksum) {
        throw new Error(`CRITICAL: Snapshot checksum validation failed. Expected: ${snapshot.snapshot_checksum}, Calculated: ${calculated}`);
      }
    }

    await db.transaction('rw', [db.variants, db.settings], async () => {
      // 2. Restore database state from snapshot checkpoint
      const variants = (snapshot && snapshot.data && snapshot.data.variants) || (snapshot && snapshot.variants) || [];
      await db.variants.clear();
      if (variants.length > 0) {
        await db.variants.bulkAdd(variants);
      }

      // 3. Process subsequent events that occurred after snapshot position
      for (const event of subsequentEvents) {
        await this.projectEvent(event);
      }

      await db.settings.put({ key: 'projection_version', value: PROJECTION_VERSION });
      await db.settings.put({ key: 'projection_checksum', value: PROJECTION_CHECKSUM });
      await db.settings.put({ key: 'projections_rebuilt_at', value: new Date().toISOString() });
    });
  }

  /**
   * REPLAY MODE: Audit Replay
   * Replays events in-memory, computes final state checksums, and flags drift detection
   */
  static async executeAuditReplay(events: DomainEvent[]): Promise<{ driftDetected: boolean; diffDetails?: string }> {
    const memoryVariants: Map<string, number> = new Map();

    // Replay in memory
    events.forEach(event => {
      if (event.event_type === 'sale.item_added') {
        const { variant_id, quantity } = event.payload;
        const current = memoryVariants.get(variant_id) || 0;
        memoryVariants.set(variant_id, Math.max(0, current - quantity));
      } else if (event.event_type === 'stock.adjusted') {
        const { variant_id, quantity } = event.payload;
        const current = memoryVariants.get(variant_id) || 0;
        memoryVariants.set(variant_id, current + quantity);
      }
    });

    // Compare with current local IndexedDB
    const activeVariants = await db.variants.toArray();
    let driftCount = 0;
    let diffMsg = '';

    activeVariants.forEach(av => {
      const calculatedQty = memoryVariants.get(av.id) || 0;
      if (av.quantity !== calculatedQty) {
        driftCount++;
        diffMsg += `[Drift] Variant ${av.id}: Active Quantity = ${av.quantity}, Recalculated = ${calculatedQty}\n`;
      }
    });

    const driftDetected = driftCount > 0;
    if (driftDetected) {
      await Telemetry.error('security', `Drift detected in state projection ledger: ${driftCount} variants mismatched.`, { driftCount });
    }

    return { driftDetected, diffDetails: diffMsg };
  }
}

export async function calculateSnapshotChecksum(data: any): Promise<string> {
  const dataStr = JSON.stringify(data);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const dataUint8 = encoder.encode(dataStr);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node.js environment fallback
    try {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(dataStr).digest('hex');
    } catch {
      // Fallback
      let hash = 0;
      for (let i = 0; i < dataStr.length; i++) {
        const char = dataStr.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return `fallback_${hash}`;
    }
  }
}
