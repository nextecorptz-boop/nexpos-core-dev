import { type DomainEvent } from '../sync/commands';
import { Telemetry } from '../telemetry/telemetry';

export type EventBusCallback = (event: DomainEvent) => void | Promise<void>;

type BufferedEvent = DomainEvent & { _addedAt?: number };

class EventBusV2 {
  private eventListeners: Map<string, Set<EventBusCallback>> = new Map();
  private aggregateListeners: Map<string, Set<EventBusCallback>> = new Map();
  private branchListeners: Map<string, Set<EventBusCallback>> = new Map();
  private eventBuffer: BufferedEvent[] = [];
  private readonly maxBufferSize = 200;
  private readonly ttlMs = 5 * 60 * 1000; // 5 minutes TTL

  /**
   * Subscribe to specific event types (e.g. 'sale.completed')
   */
  subscribe(eventType: string, callback: EventBusCallback): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);
    return () => this.eventListeners.get(eventType)?.delete(callback);
  }

  /**
   * Subscribe to specific aggregate instances (e.g. variant_id)
   */
  subscribeToAggregate(aggregateId: string, callback: EventBusCallback): () => void {
    if (!this.aggregateListeners.has(aggregateId)) {
      this.aggregateListeners.set(aggregateId, new Set());
    }
    this.aggregateListeners.get(aggregateId)!.add(callback);
    return () => this.aggregateListeners.get(aggregateId)?.delete(callback);
  }

  /**
   * Subscribe to specific branch locations
   */
  subscribeToBranch(branchId: string, callback: EventBusCallback): () => void {
    if (!this.branchListeners.has(branchId)) {
      this.branchListeners.set(branchId, new Set());
    }
    this.branchListeners.get(branchId)!.add(callback);
    return () => this.branchListeners.get(branchId)?.delete(callback);
  }

  /**
   * Publish an event onto the local pipeline and trigger consumers
   */
  async publish(event: DomainEvent): Promise<void> {
    // 1. Maintain local history buffer with TTL eviction
    const now = Date.now();
    const bufferedEvent: BufferedEvent = { ...event, _addedAt: now };
    this.eventBuffer.push(bufferedEvent);

    // Evict expired events and respect max buffer size
    const cutoff = now - this.ttlMs;
    this.eventBuffer = this.eventBuffer.filter(e => (e._addedAt ?? now) > cutoff);

    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-this.maxBufferSize);
    }

    // 2. Resolve subscribers
    const targets: EventBusCallback[] = [];

    // Match event type
    const eSubs = this.eventListeners.get(event.event_type);
    if (eSubs) eSubs.forEach(cb => targets.push(cb));

    // Match aggregate ID
    const aSubs = this.aggregateListeners.get(event.aggregate_id);
    if (aSubs) aSubs.forEach(cb => targets.push(cb));

    // Match branch scoped
    if (event.branch_id) {
      const bSubs = this.branchListeners.get(event.branch_id);
      if (bSubs) bSubs.forEach(cb => targets.push(cb));
    }

    // 3. Trigger async execution
    await Promise.all(
      targets.map(async (callback) => {
        try {
          await callback(event);
        } catch (err) {
          console.error(`Consumer failed for event ${event.event_type}:`, err);
          await Telemetry.warn('sync', `Event consumer failure in ${event.event_type}`, err);
        }
      })
    );

    // 4. Dispatch browser custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nx-event-bus-v2', { detail: event }));
    }
  }

  /**
   * Replay cached buffer events matching a predicate
   */
  async replayBufferedEvents(predicate: (event: DomainEvent) => boolean, callback: EventBusCallback): Promise<void> {
    const matched = this.eventBuffer.filter(predicate);
    for (const event of matched) {
      try {
        await callback(event);
      } catch (err) {
        console.error('Buffer event replay failed:', err);
      }
    }
  }
}

export const eventBusV2 = new EventBusV2();
export default eventBusV2;
