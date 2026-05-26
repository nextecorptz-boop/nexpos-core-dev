import { db } from './db';
import { type DomainEvent } from './commands';
import { Telemetry } from '../telemetry/telemetry';

export class ConflictResolutionEngine {
  /**
   * Evaluates if a domain event is safe to project or sync.
   * Enforces optimistic concurrency rules using aggregate versions,
   * completely ignoring client-side timestamps.
   */
  static async resolve(event: DomainEvent): Promise<{
    action: 'project' | 'suppress' | 'quarantine';
    reason?: string;
  }> {
    // 1. Deduplication Check
    const eventCompleted = await db.settings.get(`event_processed_${event.id}`);
    if (eventCompleted) {
      return {
        action: 'suppress',
        reason: `Deduplication: Event ${event.id} already processed.`
      };
    }

    // 2. Aggregate Version Sequencing
    const versionKey = `aggregate_version_${event.aggregate_id}`;
    const versionSetting = await db.settings.get(versionKey);
    const currentVersion = versionSetting ? Number(versionSetting.value) : 0;

    // Reject obsolete versions (replay suppression)
    if (event.event_version <= currentVersion) {
      return {
        action: 'suppress',
        reason: `Stale version: Event version ${event.event_version} is older or equal to current sequence (${currentVersion}).`
      };
    }

    // Gap detection: Event version skipped steps (out-of-order delivery)
    if (event.event_version > currentVersion + 1) {
      await Telemetry.warn(
        'sync',
        `Replay gap on aggregate ${event.aggregate_id}: expected ${currentVersion + 1}, got ${event.event_version}. Quarantining.`
      );
      return {
        action: 'quarantine',
        reason: `Sequence Gap: Event version ${event.event_version} received, expected ${currentVersion + 1}.`
      };
    }

    // 3. Business Invariant Protections
    if (event.event_type === 'sale.item_added') {
      const { variant_id, quantity } = event.payload;
      const variant = await db.variants.get(variant_id);
      
      // Stock protection invariant
      if (!variant || variant.quantity < quantity) {
        return {
          action: 'quarantine',
          reason: `Negative Stock Guard: Variant ${variant_id} current stock is ${variant?.quantity || 0}, sale requested ${quantity}.`
        };
      }
    }

    if (event.event_type === 'cash_session.closed') {
      const isClosedSetting = await db.settings.get(`session_closed_${event.aggregate_id}`);
      if (isClosedSetting && isClosedSetting.value === 'true') {
        return {
          action: 'quarantine',
          reason: `Closed Session Guard: Cash session ${event.aggregate_id} is already closed.`
        };
      }
    }

    // 4. Update Sequence Version Watermark
    await db.settings.put({ key: versionKey, value: event.event_version });
    await db.settings.put({ key: `event_processed_${event.id}`, value: 'true' });

    return { action: 'project' };
  }
}
export default ConflictResolutionEngine;
