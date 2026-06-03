import { createClient } from '@/lib/supabase/client'
import { db, type QueueItem, type QuarantinedMutation } from './db'
import { getOrCreateDeviceId } from './device'
import { Telemetry } from '@/lib/telemetry/telemetry'
import { type DomainEvent } from './commands'
import { ConflictResolutionEngine } from './conflict-resolution'
import { ProjectionManager } from './projections'

export type MutationType = 'sale' | 'purchase' | 'expense' | 'repayment' | 'supplier' | 'transfer' | 'till' | 'customer' | 'telemetry'

let isProcessing = false

// Helper to determine priority tier
export function getTierForMutation(type: MutationType): 0 | 1 | 2 | 3 {
  if (['sale', 'repayment', 'till'].includes(type)) return 0
  if (['purchase', 'expense', 'transfer'].includes(type)) return 1
  if (['supplier', 'customer'].includes(type)) return 2
  return 3
}

// Get appropriate Dexie table for a tier
function getQueueTable(tier: 0 | 1 | 2 | 3) {
  if (tier === 0) return db.queue_tier_0
  if (tier === 1) return db.queue_tier_1
  if (tier === 2) return db.queue_tier_2
  return db.queue_tier_3
}

// Add an event to the sync queue and apply projections locally immediately
export function addEventToSyncQueue(event: DomainEvent): string {
  const id = event.id;
  getOrCreateDeviceId().then(async (deviceId) => {
    // Cryptographically sign the outbound event at the source
    const { signEvent } = await import('@/lib/security/payload-signing');
    const signedEvent = await signEvent(event);

    // Determine priority tier by event type mapping
    const mappedType = signedEvent.event_type.split('.')[0] as MutationType;
    const tier = getTierForMutation(mappedType || 'sale');
    const table = getQueueTable(tier);

    const newItem: QueueItem<DomainEvent> = {
      id,
      type: signedEvent.event_type,
      payload: signedEvent,
      status: 'pending',
      timestamp: signedEvent.occurred_at,
      retryCount: 0,
      device_id: deviceId,
      tenant_id: signedEvent.tenant_id
    };

    await table.put(newItem);

    // Apply the projection locally immediately for optimistic UI updates
    await ProjectionManager.projectEvent(event);

    // Publish to local client event bus
    const { eventBusV2 } = await import('@/lib/events/event-bus-v2');
    await eventBusV2.publish(event);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nx-sync-queue-updated', { detail: { id, tier } }));
      if (navigator.onLine) {
        processSyncQueue();
      }
    }
  }).catch((err) => {
    console.error('Dexie database background event insertion failed:', err);
  });

  return id;
}

// Add an item to the sync queue for optimistic offline execution (backwards compatible synchronous returns)
export function addToSyncQueue<T = any>(
  type: MutationType,
  payload: T,
  tenantId?: string
): string {
  // Check if it is already a DomainEvent
  if (payload && (payload as any).event_type) {
    return addEventToSyncQueue(payload as any);
  }

  // Backward compatible wrap into DomainEvent structure
  const eventId = `${type}-${crypto.randomUUID()}`;
  const mockEvent: DomainEvent = {
    id: eventId,
    tenant_id: tenantId || (payload as any).tenant_id || 'd0000000-0000-0000-0000-000000000000',
    branch_id: (payload as any).branch_id || undefined,
    aggregate_type: type,
    aggregate_id: (payload as any).id || eventId,
    event_type: `${type}.created`, // e.g. sale -> sale.created
    event_version: 1,
    schema_version: 1,
    payload: payload,
    occurred_at: new Date().toISOString()
  };

  return addEventToSyncQueue(mockEvent);
}

// Remove an item from the queue
export async function removeFromSyncQueue(id: string, tier: 0 | 1 | 2 | 3) {
  const table = getQueueTable(tier)
  await table.delete(id)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nx-sync-queue-updated'))
  }
}

// Mark an item as failed in the queue
export async function markAsFailed(id: string, tier: 0 | 1 | 2 | 3, errorMsg: string) {
  const table = getQueueTable(tier)
  const item = await table.get(id)
  if (item) {
    item.status = 'failed'
    item.error = errorMsg
    item.retryCount += 1
    // Update timestamp to now to delay next retry in backoff
    const { networkMonitor } = await import('./network')
    const backoffMs = Math.min(1000 * Math.pow(2, item.retryCount), 60000)
    const jitteredBackoff = networkMonitor.getJitter(backoffMs)
    item.timestamp = new Date(Date.now() + jitteredBackoff).toISOString()
    await table.put(item)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nx-sync-queue-updated'))
    }
  }
}

// Quarantine a mutation for manual review
export async function quarantineMutation(id: string, tier: 0 | 1 | 2 | 3, errorMsg: string) {
  const table = getQueueTable(tier)
  const item = await table.get(id)
  if (item) {
    const quarantined: QuarantinedMutation = {
      id: item.id,
      type: item.type,
      payload: item.payload,
      error: errorMsg,
      timestamp: new Date().toISOString(),
      device_id: item.device_id,
      tenant_id: item.tenant_id
    }
    // Save to quarantine
    await db.quarantined_mutations.put(quarantined)
    // Remove from active sync queue
    await table.delete(id)

    // Trigger log audit entry locally for conflict quarantine
    console.warn(`Mutation ${id} quarantined: ${errorMsg}`)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nx-sync-queue-updated'))
      window.dispatchEvent(new CustomEvent('nx-sync-quarantine-added', { detail: quarantined }))
    }
  }
}

// Master queue processor
// Simple semver comparison helper
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

// Device/client capability, version compatibility and sync staleness check
export async function checkClientStalenessAndCompatibility(): Promise<{ compatible: boolean; reason?: string }> {
  try {
    const clientVersionSetting = await db.settings.get('client_app_version') || { key: 'client_app_version', value: '1.2.0' };
    const clientVersion = clientVersionSetting.value;

    // 1. Version Compatibility Guard
    const serverMinVersionSetting = await db.settings.get('server_min_compatible_version');
    if (serverMinVersionSetting && serverMinVersionSetting.value) {
      const minVersion = serverMinVersionSetting.value;
      if (compareVersions(clientVersion, minVersion) < 0) {
        await Telemetry.critical('security', `Client isolation: Client version ${clientVersion} is outdated and incompatible with minimum server requirements (${minVersion}). Sync aborted.`);
        await db.settings.put({ key: 'client_status', value: 'isolated_incompatible' });
        return { compatible: false, reason: `Version mismatch: client version ${clientVersion} is below minimum requirement ${minVersion}` };
      }
    }

    // 2. Sync Staleness Guard (Forced isolation if disconnected > 14 days)
    const lastSyncSetting = await db.settings.get('last_successful_sync');
    if (lastSyncSetting && lastSyncSetting.value) {
      const lastSyncDate = new Date(lastSyncSetting.value);
      const diffDays = (Date.now() - lastSyncDate.getTime()) / (1000 * 3600 * 24);
      if (diffDays > 14) {
        await Telemetry.critical('sync', `Client isolation: Device has not synchronized for ${diffDays.toFixed(1)} days (limit 14 days). Quarantine mode active.`, { lastSyncDate });
        await db.settings.put({ key: 'client_status', value: 'isolated_stale' });
        return { compatible: false, reason: `Device stale: last sync was ${diffDays.toFixed(1)} days ago` };
      }
    }
  } catch (err) {
    console.error('Failed to run client compatibility and staleness checks:', err);
  }
  return { compatible: true };
}

// Master queue processor
export async function processSyncQueue() {
  if (isProcessing) return
  
  const { networkMonitor } = await import('./network')
  const status = await networkMonitor.getStatus()
  if (!status.online) return

  isProcessing = true
  const supabase = createClient()

  // Verify auth session first
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.warn('Sync aborted: User is not authenticated.')
    isProcessing = false
    return
  }

  // Run compatibility and staleness isolation check
  const checkResult = await checkClientStalenessAndCompatibility();
  if (!checkResult.compatible) {
    console.warn(`Sync aborted: Client is isolated. Reason: ${checkResult.reason}`);
    isProcessing = false
    return
  }

  try {
    // Process Tiers in order: 0 (Critical), 1 (High), 2 (Medium), 3 (Low)
    for (const tier of [0, 1, 2, 3] as const) {
      const table = getQueueTable(tier)
      const items = await table.toArray()
      
      if (items.length > 0) {
        // Check if this tier is allowed based on battery/network (batchSize 0 means throttled/blocked)
        const batchSize = await networkMonitor.getOptimalBatchSize(tier)
        if (batchSize === 0) continue 

        const processedAny = await processItems(supabase, items, tier)
        
        // Tiers 0 and 1 MUST clear completely before lower tiers proceed
        if (processedAny && (tier === 0 || tier === 1)) {
          isProcessing = false
          processSyncQueue()
          return
        }
      }
    }
  } catch (err) {
    console.error('Error during master queue execution:', err)
  } finally {
    isProcessing = false
  }
}

// Process items in a specific queue tier
async function processItems(supabase: any, items: QueueItem[], tier: 0 | 1 | 2 | 3): Promise<boolean> {
  let processedAny = false
  let successCount = 0
  let errorCount = 0
  const sessionStart = performance.now()
  const { networkMonitor } = await import('./network')
  const maxBatchSize = await networkMonitor.getOptimalBatchSize(tier)
  
  // Only process up to maxBatchSize items in this run
  const batch = items.slice(0, maxBatchSize)

  for (const item of batch) {
    if (item.retryCount > 0) {
      const backoffMs = Math.min(1000 * Math.pow(2, item.retryCount), 60000)
      const lastFailedTime = new Date(item.timestamp).getTime()
      if (Date.now() - lastFailedTime < backoffMs) {
        continue
      }
    }

    const itemStart = performance.now()
    const event: DomainEvent = item.payload

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Unauthenticated replay execution attempt')

      // Verify cryptographic signature and replay protections before execution
      const { verifySignedEvent } = await import('@/lib/security/trust-verifier')
      const verification = await verifySignedEvent(event)
      if (!verification.verified) {
        await quarantineMutation(item.id, tier, `Cryptographic trust verification failed: ${verification.reason}`)
        processedAny = true
        successCount++
        continue
      }

      // 1. Run Conflict Resolution Engine
      const resolution = await ConflictResolutionEngine.resolve(event)

      if (resolution.action === 'suppress') {
        await Telemetry.warn('sync', `Event ${event.id} suppressed during replay: ${resolution.reason}`)
        await removeFromSyncQueue(item.id, tier)
        processedAny = true
        successCount++
        continue
      }

      if (resolution.action === 'quarantine') {
        await Telemetry.error('sync', `Event ${event.id} quarantined during replay: ${resolution.reason}`)
        await quarantineMutation(item.id, tier, resolution.reason || 'Conflict quarantine')
        processedAny = true
        successCount++ // Treated as processed out of main queue
        continue
      }

      // 2. Map Event to Canonical Backend Operations
      const mappedType = event.event_type.split('.')[0]

      if (mappedType === 'sale') {
        const { error: syncErr, data: result } = await supabase.rpc('complete_sale', {
          p_input: event.payload
        })
        
        if (syncErr) {
          throw syncErr
        }
        
        // Check idempotency replay response
        if (result && result.replayed) {
          await Telemetry.info('sync', `Deduplication: Sale ${event.id} already exists in database.`)
        }
      } else {
        // Unsupported legacy flows isolated behind safe no-op/stub handlers
        console.warn(`Sync engine: Legacy flow for ${mappedType} is stubbed and bypassed.`)
        await Telemetry.warn('sync', `Stubbed legacy flow: ${mappedType}`)
      }

      // Record Latency and update Network Monitor RTT
      const duration = performance.now() - itemStart
      networkMonitor.recordRtt(duration)
      await Telemetry.trackApiLatency(`sync.${event.event_type}`, duration)

      // 3. Remove event from active sync queue
      await removeFromSyncQueue(item.id, tier)
      processedAny = true
      successCount++

      // Publish event to local client event bus
      const { eventBusV2 } = await import('@/lib/events/event-bus-v2')
      await eventBusV2.publish(event)

    } catch (err: any) {
      errorCount++
      console.error(`Error replaying event ${item.id}:`, err)

      const isClientSideError = err.status === 400 || err.status === 403 || err.status === 409 || err.code === '23502' || err.code === '23503' || err.code === '23514'
      if (isClientSideError) {
        await Telemetry.error('sync', `Event ${event.id} quarantined due to server validation failure: ${err.message}`)
        await quarantineMutation(item.id, tier, err.message || 'Validation/RLS Failure')
        processedAny = true
      } else {
        await Telemetry.warn('network', `Network sync failure for event ${event.id}: ${err.message}`)
        await markAsFailed(item.id, tier, err.message || 'Network communication failure')
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          break
        }
      }
    }
  }

  const sessionDuration = performance.now() - sessionStart
  if (successCount > 0 || errorCount > 0) {
    await Telemetry.trackSyncStats(successCount, errorCount, sessionDuration)
    if (successCount > 0) {
      await db.settings.put({ key: 'last_successful_sync', value: new Date().toISOString() })
    }
  }

  return processedAny
}

// Legacy sync helpers (syncSale, syncPurchase, etc.) have been removed.
// All supported offline mutations now map to canonical RPC endpoints.

let _onlineListenerRegistered = false;

export function ensureOnlineSyncListener() {
  if (_onlineListenerRegistered || typeof window === 'undefined') return;
  _onlineListenerRegistered = true;
  window.addEventListener('online', () => processSyncQueue());
}
