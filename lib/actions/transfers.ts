'use server'

import { createClient } from '@/lib/supabase/client'
import { revalidatePath } from 'next/cache'

// Server-authoritative role check helper
async function validateUserPermission(
  supabase: any,
  action: 'create' | 'dispatch' | 'receive' | 'cancel',
  branchContext?: { fromBranchId?: string; toBranchId?: string }
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Mtumiaji hajatambulishwa (Unauthenticated)')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('tenant_id, role, branch_id')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw new Error('Imeshindwa kuthibitisha wasifu wa mtumiaji (Failed to verify user profile)')
  }

  const role = profile.role // 'owner' | 'manager' | 'cashier'

  // Owner has absolute clearance
  if (role === 'owner') {
    return { user, profile }
  }

  if (role === 'manager') {
    if (action === 'create' || action === 'dispatch' || action === 'cancel') {
      if (branchContext?.fromBranchId && profile.branch_id !== branchContext.fromBranchId) {
        throw new Error('Huna kibali cha kusimamia tawi hili la chanzo (Unauthorized for this source branch)')
      }
    }
    if (action === 'receive') {
      if (branchContext?.toBranchId && profile.branch_id !== branchContext.toBranchId) {
        throw new Error('Huna kibali cha kupokea mzigo katika tawi hili (Unauthorized for this destination branch)')
      }
    }
    return { user, profile }
  }

  // Cashiers are strictly blocked from writing transfers
  throw new Error('Huna mamlaka ya kufanya operesheni hii (Unauthorized. Manager overrides required.)')
}

// 1. Create Transfer in Draft Mode
export async function createTransferAction(
  fromBranchId: string,
  toBranchId: string,
  items: { variant_id: string; quantity: number }[],
  notes: string = ''
) {
  const supabase = createClient()

  const { user, profile } = await validateUserPermission(supabase, 'create', { fromBranchId })

  if (fromBranchId === toBranchId) {
    throw new Error('Huwezi kuhamisha mzigo kwenda tawi lile lile (Source and destination branches cannot be the same)')
  }

  if (!items || items.length === 0) {
    throw new Error('Orodha ya bidhaa haipo (Items list is empty)')
  }

  // Insert transfer record
  const { data: transfer, error: tErr } = await supabase
    .from('transfers')
    .insert({
      tenant_id: profile.tenant_id,
      from_branch_id: fromBranchId,
      to_branch_id: toBranchId,
      notes,
      created_by: user.id,
      status: 'draft'
    })
    .select()
    .single()

  if (tErr) throw new Error(`Draft creation failed: ${tErr.message}`)

  // Insert items
  const transferItems = items.map((item) => ({
    tenant_id: profile.tenant_id,
    transfer_id: transfer.id,
    variant_id: item.variant_id,
    quantity: item.quantity
  }))

  const { error: itemsErr } = await supabase.from('transfer_items').insert(transferItems)
  if (itemsErr) {
    // Rollback transfer draft
    await supabase.from('transfers').delete().eq('id', transfer.id)
    throw new Error(`Failed to insert items: ${itemsErr.message}`)
  }

  revalidatePath('/app/transfers')
  return { success: true, transferId: transfer.id }
}

// 2. Dispatch Transfer (Atomic inventory deduction + reservation)
export async function dispatchTransferAction(transferId: string) {
  const supabase = createClient()

  // Fetch transfer details to verify branch ownership
  const { data: transfer, error: fetchErr } = await supabase
    .from('transfers')
    .select('from_branch_id, to_branch_id, status')
    .eq('id', transferId)
    .single()

  if (fetchErr || !transfer) {
    throw new Error('Mzigo haukupatikana (Transfer records not found)')
  }

  const { user } = await validateUserPermission(supabase, 'dispatch', {
    fromBranchId: transfer.from_branch_id
  })

  // Call the atomic SQL stored procedure
  const { error: rpcErr } = await supabase.rpc('dispatch_transfer_atomic', {
    p_transfer_id: transferId,
    p_actor_id: user.id
  })

  if (rpcErr) {
    throw new Error(`Dispatch failed: ${rpcErr.message}`)
  }

  revalidatePath('/app/transfers')
  return { success: true }
}

// 3. Receive Transfer (Clear reservation, increment target stock)
export async function receiveTransferAction(
  transferId: string,
  receivedQtys: Record<string, number>
) {
  const supabase = createClient()

  const { data: transfer, error: fetchErr } = await supabase
    .from('transfers')
    .select('from_branch_id, to_branch_id, status')
    .eq('id', transferId)
    .single()

  if (fetchErr || !transfer) {
    throw new Error('Mzigo haukupatikana (Transfer records not found)')
  }

  const { user } = await validateUserPermission(supabase, 'receive', {
    toBranchId: transfer.to_branch_id
  })

  // Call atomic receive procedure
  const { error: rpcErr } = await supabase.rpc('receive_transfer_atomic', {
    p_transfer_id: transferId,
    p_actor_id: user.id,
    p_received_qtys: receivedQtys
  })

  if (rpcErr) {
    throw new Error(`Receipt failed: ${rpcErr.message}`)
  }

  revalidatePath('/app/transfers')
  return { success: true }
}

// 4. Cancel Transfer (Return stock, clear reservations)
export async function cancelTransferAction(transferId: string) {
  const supabase = createClient()

  const { data: transfer, error: fetchErr } = await supabase
    .from('transfers')
    .select('from_branch_id, to_branch_id, status')
    .eq('id', transferId)
    .single()

  if (fetchErr || !transfer) {
    throw new Error('Mzigo haukupatikana (Transfer records not found)')
  }

  const { user } = await validateUserPermission(supabase, 'cancel', {
    fromBranchId: transfer.from_branch_id
  })

  // Call atomic cancel procedure
  const { error: rpcErr } = await supabase.rpc('cancel_transfer_atomic', {
    p_transfer_id: transferId,
    p_actor_id: user.id
  })

  if (rpcErr) {
    throw new Error(`Cancellation failed: ${rpcErr.message}`)
  }

  revalidatePath('/app/transfers')
  return { success: true }
}
