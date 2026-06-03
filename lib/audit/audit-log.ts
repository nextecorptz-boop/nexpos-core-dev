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
  console.warn('logSecurityEvent is stubbed. Legacy audit_logs query bypassed.', params)
}

// Queue audit log when offline
export async function logSecurityEventOffline(params: AuditEventParams) {
  console.warn('logSecurityEventOffline is stubbed. Legacy audit_logs query bypassed.', params)
}
