import { db } from './db';
import { type DomainEvent } from './commands';
import { Telemetry } from '../telemetry/telemetry';

export interface AuditReport {
  timestamp: string;
  totalEventsChecked: number;
  missingEventsCount: number;
  driftsCount: number;
  details: string[];
  passed: boolean;
}

export class LedgerAuditor {
  /**
   * Runs consistency diagnostics over local event stores.
   * Detects missing events (sequence gaps) and state projection drift.
   */
  static async auditLocalLedger(events: DomainEvent[]): Promise<AuditReport> {
    const report: AuditReport = {
      timestamp: new Date().toISOString(),
      totalEventsChecked: events.length,
      missingEventsCount: 0,
      driftsCount: 0,
      details: [],
      passed: true
    };

    // 1. Group events by aggregate ID and check version continuity
    const streams: Map<string, DomainEvent[]> = new Map();
    events.forEach(e => {
      if (!streams.has(e.aggregate_id)) {
        streams.set(e.aggregate_id, []);
      }
      streams.get(e.aggregate_id)!.push(e);
    });

    streams.forEach((stream, aggregateId) => {
      // Sort ascending by version
      stream.sort((a, b) => a.event_version - b.event_version);
      
      let expectedVersion = stream[0].event_version; // Start from first recorded version
      
      stream.forEach(event => {
        if (event.event_version !== expectedVersion) {
          report.missingEventsCount++;
          report.details.push(
            `[Sequence Gap] Aggregate ${aggregateId} (Type: ${event.aggregate_type}): ` +
            `expected version ${expectedVersion}, found ${event.event_version}.`
          );
          expectedVersion = event.event_version; // Sync expectation to current version
        }
        expectedVersion++;
      });
    });

    // 2. Perform in-memory stock projections to detect drift against IndexedDB active values
    const calculatedStocks: Map<string, number> = new Map();
    events.forEach(event => {
      if (event.event_type === 'sale.item_added') {
        const { variant_id, quantity } = event.payload;
        const current = calculatedStocks.get(variant_id) || 0;
        calculatedStocks.set(variant_id, Math.max(0, current - quantity));
      } else if (event.event_type === 'stock.adjusted') {
        const { variant_id, quantity } = event.payload;
        const current = calculatedStocks.get(variant_id) || 0;
        calculatedStocks.set(variant_id, current + quantity);
      }
    });

    const activeVariants = await db.variants.toArray();
    activeVariants.forEach(v => {
      const calculatedVal = calculatedStocks.get(v.id) || 0;
      if (v.quantity !== calculatedVal) {
        report.driftsCount++;
        report.details.push(
          `[State Drift] Variant ${v.id} (Name: ${v.name}): ` +
          `Active quantity = ${v.quantity}, Replayed ledger calculation = ${calculatedVal}`
        );
      }
    });

    report.passed = report.missingEventsCount === 0 && report.driftsCount === 0;

    if (!report.passed) {
      await Telemetry.error(
        'security',
        `Ledger integrity check failed: ${report.missingEventsCount} version gaps and ${report.driftsCount} projection drifts.`,
        report
      );
    } else {
      await Telemetry.info('sync', `Ledger audit complete. Verified ${report.totalEventsChecked} events without drift.`);
    }

    return report;
  }
}
export default LedgerAuditor;
