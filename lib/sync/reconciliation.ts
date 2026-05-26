import { db } from './db'
import { addToSyncQueue, getTierForMutation, type MutationType } from './sync-engine'

// Retry a quarantined mutation by pushing it back into the active priority queue
export async function retryQuarantinedMutation(id: string): Promise<boolean> {
  const item = await db.quarantined_mutations.get(id)
  if (!item) return false

  const tier = getTierForMutation(item.type as MutationType)
  const queueTable = tier === 1 ? db.queue_tier_1 : tier === 2 ? db.queue_tier_2 : db.queue_tier_3

  // Return it back to the active queue
  await queueTable.put({
    id: item.id,
    type: item.type,
    payload: item.payload,
    status: 'pending',
    timestamp: new Date().toISOString(),
    retryCount: 0,
    device_id: item.device_id,
    tenant_id: item.tenant_id
  })

  // Delete from quarantined table
  await db.quarantined_mutations.delete(id)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nx-sync-queue-updated'))
    window.dispatchEvent(new CustomEvent('nx-sync-quarantine-removed', { detail: { id } }))
  }

  return true
}

// Discard a quarantined mutation permanently
export async function discardQuarantinedMutation(id: string): Promise<boolean> {
  const exists = await db.quarantined_mutations.get(id)
  if (!exists) return false

  await db.quarantined_mutations.delete(id)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nx-sync-queue-updated'))
    window.dispatchEvent(new CustomEvent('nx-sync-quarantine-removed', { detail: { id } }))
  }

  return true
}
