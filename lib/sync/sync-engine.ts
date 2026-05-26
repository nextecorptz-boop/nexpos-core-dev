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

      // 2. Sync to Supabase Central Event Store
      const { error: syncErr } = await supabase
        .from('event_store')
        .insert({
          id: event.id,
          tenant_id: event.tenant_id,
          branch_id: event.branch_id || null,
          aggregate_type: event.aggregate_type,
          aggregate_id: event.aggregate_id,
          event_type: event.event_type,
          event_version: event.event_version,
          schema_version: event.schema_version,
          payload: event.payload,
          metadata: event.metadata || {},
          actor_id: event.actor_id || null,
          correlation_id: event.correlation_id || null,
          causation_id: event.causation_id || null,
          device_id: item.device_id,
          idempotency_key: event.idempotency_key || event.id,
          occurred_at: event.occurred_at
        })

      if (syncErr) {
        // Handle database duplicate key error (already synced)
        if (syncErr.code === '23505') {
          await Telemetry.info('sync', `Deduplication: Event ${event.id} already exists in database.`)
          await removeFromSyncQueue(item.id, tier)
          processedAny = true
          successCount++
          continue
        }
        throw syncErr
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

// Helper: Sync Sale
async function syncSale(supabase: any, payload: any, id: string) {
  // Check deduplication
  const { data: existing } = await supabase
    .from('sales')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (existing) return

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      id: id, // Client UUID mapped directly
      receipt_number: payload.receipt_number,
      total_amount: payload.total_amount,
      subtotal: payload.subtotal,
      discount_amount: payload.discount_amount || 0,
      amount_paid: payload.amount_paid,
      balance_due: payload.balance_due || 0,
      status: payload.status,
      customer_id: payload.customer_id || null,
      notes: payload.notes || '',
      branch_id: payload.branch_id
    })
    .select()
    .single()

  if (saleErr) throw saleErr

  // Insert items
  if (payload.sale_items && payload.sale_items.length > 0) {
    const items = payload.sale_items.map((item: any) => ({
      sale_id: sale.id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
      cost_price: item.cost_price,
      tenant_id: sale.tenant_id
    }))
    const { error: itemsErr } = await supabase.from('sale_items').insert(items)
    if (itemsErr) throw itemsErr
  }

  // Insert payments
  if (payload.payments && payload.payments.length > 0) {
    const payments = payload.payments.map((pay: any) => ({
      sale_id: sale.id,
      payment_method: pay.payment_method,
      amount: pay.amount,
      reference_code: pay.reference_code || '',
      tenant_id: sale.tenant_id
    }))
    const { error: payErr } = await supabase.from('payments').insert(payments)
    if (payErr) throw payErr
  }
}

// Helper: Sync Purchase
async function syncPurchase(supabase: any, payload: any, id: string) {
  const { data: existing } = await supabase
    .from('purchases')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (existing) return

  const { data: purchase, error: pErr } = await supabase
    .from('purchases')
    .insert({
      id: id,
      supplier_id: payload.supplier_id,
      branch_id: payload.branch_id,
      total_amount: payload.total_amount,
      status: payload.status,
      notes: payload.notes || ''
    })
    .select()
    .single()

  if (pErr) throw pErr

  if (payload.purchase_items && payload.purchase_items.length > 0) {
    const items = payload.purchase_items.map((item: any) => ({
      purchase_id: purchase.id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      subtotal: item.subtotal,
      received_qty: item.received_qty || 0,
      tenant_id: purchase.tenant_id
    }))
    const { error: itemsErr } = await supabase.from('purchase_items').insert(items)
    if (itemsErr) throw itemsErr
  }

  // If purchase is completed, insert movements
  if (payload.status === 'completed' && payload.purchase_items) {
    const movements = payload.purchase_items.map((item: any) => ({
      variant_id: item.variant_id,
      branch_id: payload.branch_id,
      movement_type: 'purchase_in',
      quantity: item.quantity,
      reference_id: purchase.id,
      reference_type: 'purchase',
      notes: 'Purchase order received',
      tenant_id: purchase.tenant_id
    }))
    const { error: movErr } = await supabase.from('inventory_movements').insert(movements)
    if (movErr) throw movErr
  }
}

// Helper: Sync Expense
async function syncExpense(supabase: any, payload: any) {
  const { error } = await supabase
    .from('expenses')
    .insert({
      branch_id: payload.branch_id,
      category_id: payload.category_id,
      amount: payload.amount,
      description: payload.description,
      expense_date: payload.expense_date
    })
  if (error) throw error
}

// Helper: Sync Repayment
async function syncRepayment(supabase: any, payload: any, id: string) {
  // Check deduplication
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (existing) return

  // First record payment transaction
  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      id: id,
      branch_id: payload.branch_id,
      payment_method: payload.payment_method,
      amount: payload.amount,
      reference_code: payload.reference_code || ''
    })
    .select()
    .single()

  if (payErr) throw payErr

  // Record credit repayment linkage
  const { error: repayErr } = await supabase
    .from('credit_repayments')
    .insert({
      credit_account_id: payload.credit_account_id,
      payment_id: payment.id,
      amount: payload.amount,
      notes: payload.notes || '',
      tenant_id: payment.tenant_id
    })

  if (repayErr) throw repayErr
}

// Helper: Sync Supplier
async function syncSupplier(supabase: any, payload: any, id: string) {
  const { data: existing } = await supabase
    .from('suppliers')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (existing) return

  const { error } = await supabase
    .from('suppliers')
    .insert({
      id: id,
      name: payload.name,
      contact_person: payload.contact_person || '',
      phone: payload.phone,
      email: payload.email || '',
      address: payload.address || '',
      notes: payload.notes || ''
    })
  if (error) throw error
}

// Helper: Sync Transfer (Phase 10 integration)
async function syncTransfer(supabase: any, payload: any, id: string) {
  const { data: existing } = await supabase
    .from('transfers')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (existing) return

  const { data: transfer, error: tErr } = await supabase
    .from('transfers')
    .insert({
      id: id,
      from_branch_id: payload.from_branch_id,
      to_branch_id: payload.to_branch_id,
      status: payload.status,
      notes: payload.notes || '',
      dispatched_at: payload.dispatched_at || null,
      dispatched_by: payload.dispatched_by || null,
      received_at: payload.received_at || null,
      received_by: payload.received_by || null
    })
    .select()
    .single()

  if (tErr) throw tErr

  // Sync transfer items
  if (payload.items && payload.items.length > 0) {
    const items = payload.items.map((item: any) => ({
      transfer_id: transfer.id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      received_qty: item.received_qty || null,
      tenant_id: transfer.tenant_id
    }))
    const { error: itemsErr } = await supabase.from('transfer_items').insert(items)
    if (itemsErr) throw itemsErr
  }
}

let _onlineListenerRegistered = false;

export function ensureOnlineSyncListener() {
  if (_onlineListenerRegistered || typeof window === 'undefined') return;
  _onlineListenerRegistered = true;
  window.addEventListener('online', () => processSyncQueue());
}
