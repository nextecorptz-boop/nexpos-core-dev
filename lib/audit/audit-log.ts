import { createClient } from '@/lib/supabase/client'
import { getOrCreateDeviceId } from '@/lib/sync/device'
import { addToSyncQueue } from '@/lib/sync/sync-engine'

export interface AuditEventParams {
  tenant_id: string
  branch_id?: string | null
  user_id: string
  action: string
  entity_type: string
  entity_id?: string | null
  old_value?: any
  new_value?: any
  offline_origin?: boolean
}

// Write audit logs to database on the server
export async function logSecurityEvent(params: AuditEventParams) {
  const supabase = createClient()
  const deviceId = await getOrCreateDeviceId()

  const { error } = await supabase
    .from('audit_logs')
    .insert({
      tenant_id: params.tenant_id,
      branch_id: params.branch_id || null,
      user_id: params.user_id,
      device_id: deviceId,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id || null,
      old_value: params.old_value || null,
      new_value: params.new_value || null,
      sync_source: params.offline_origin ? 'client' : 'server',
      offline_origin: params.offline_origin || false
    })

  if (error) {
    console.error('Failed to write database audit log:', error)
  }
}

// Queue audit log when offline
export async function logSecurityEventOffline(params: AuditEventParams) {
  const deviceId = await getOrCreateDeviceId()
  const payload = {
    tenant_id: params.tenant_id,
    branch_id: params.branch_id || null,
    user_id: params.user_id,
    device_id: deviceId,
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id || null,
    old_value: params.old_value || null,
    new_value: params.new_value || null,
    sync_source: 'client',
    offline_origin: true
  }

  // Audits are T1 mutations to prevent scrubbing bypasses
  await addToSyncQueue('expense', payload, params.tenant_id) // Using general T2 or we can queue directly
}
