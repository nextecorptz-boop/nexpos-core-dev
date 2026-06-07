'use server'

/**
 * Till Session server actions — Phase G1.1
 *
 * G1.1 limitation: expected_cash = opening_float; variance is an unreconciled
 * difference, not a true drawer variance. UI must label clearly.
 *
 * All mutations go through SECURITY DEFINER RPCs defined in
 *   supabase/migrations/20260101000018_till_sessions.sql
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type TillSession = {
  id: string
  tenant_id: string
  branch_id: string
  cashier_id: string
  opening_float: number
  opened_at: string
  closed_at: string | null
  actual_cash_counted: number | null
  expected_cash: number | null
  variance: number | null
  status: 'open' | 'closed' | 'disputed'
  close_mode: 'normal' | 'blind' | null
  owner_reviewed_at: string | null
  owner_reviewer_id: string | null
  notes: string | null
  review_notes: string | null
  created_at: string
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string }

// ─────────────────────────────────────────────────────────────────────────────
// Input schemas
// ─────────────────────────────────────────────────────────────────────────────

const openTillSchema = z.object({
  branchId: z.string().min(1, 'branch_id is required'),
  openingFloat: z.coerce.number().min(0, 'Opening float must be 0 or greater'),
})

const closeTillSchema = z.object({
  sessionId: z.string().min(1, 'session_id is required'),
  actualCashCounted: z.coerce.number().min(0, 'Counted cash must be 0 or greater'),
  closeMode: z.enum(['normal', 'blind']).default('normal'),
  notes: z.string().trim().max(2000).optional().nullable(),
})

const reviewTillSchema = z.object({
  sessionId: z.string().min(1, 'session_id is required'),
  decision: z.literal('accept'),
  notes: z.string().trim().max(2000).optional().nullable(),
})

// ─────────────────────────────────────────────────────────────────────────────
// Error mapping — Postgres SQLSTATE → friendly action errors
// ─────────────────────────────────────────────────────────────────────────────

function mapRpcError(error: { code?: string; message?: string } | null): {
  code: string
  message: string
} {
  const raw = error?.message || 'Unknown database error'
  const pgCode = error?.code || ''

  // SECURITY DEFINER raises use ERRCODE 28000 / 42501 / 22023 / 23503 / 23505
  if (raw.includes('unauthenticated') || pgCode === '28000') {
    return { code: 'UNAUTHENTICATED', message: 'Please sign in again.' }
  }
  if (raw.includes('cashier may only open till in own branch')) {
    return {
      code: 'BRANCH_MISMATCH',
      message: 'A cashier may only open a till in their assigned branch.',
    }
  }
  if (raw.includes('cashier may only close own till session')) {
    return {
      code: 'NOT_YOUR_SESSION',
      message: 'You can only close your own till session.',
    }
  }
  if (raw.includes('owner or manager only')) {
    return {
      code: 'REVIEW_FORBIDDEN',
      message: 'Only an owner or manager can review till sessions.',
    }
  }
  if (raw.includes('only decision=accept is supported')) {
    return {
      code: 'REVIEW_DECISION_UNSUPPORTED',
      message: 'Only "accept" review is available in this release.',
    }
  }
  if (raw.includes('an open till session already exists')) {
    return {
      code: 'ALREADY_OPEN',
      message: 'You already have an open till session in this branch.',
    }
  }
  if (raw.includes('is not open')) {
    return {
      code: 'NOT_OPEN',
      message: 'This till session is not open and cannot be closed.',
    }
  }
  if (raw.includes('is not reviewable')) {
    return {
      code: 'NOT_REVIEWABLE',
      message: 'Only closed or disputed sessions can be reviewed.',
    }
  }
  if (raw.includes('branch') && raw.includes('not found in tenant')) {
    return {
      code: 'BRANCH_NOT_FOUND',
      message: 'Branch was not found for your workspace.',
    }
  }
  if (raw.includes('session') && raw.includes('not found in tenant')) {
    return {
      code: 'SESSION_NOT_FOUND',
      message: 'Till session was not found for your workspace.',
    }
  }
  if (pgCode === '42501') {
    return { code: 'FORBIDDEN', message: 'You do not have permission for this action.' }
  }

  return { code: 'TILL_RPC_FAILED', message: raw }
}

// ─────────────────────────────────────────────────────────────────────────────
// openTill
// ─────────────────────────────────────────────────────────────────────────────

export async function openTill(
  input: z.input<typeof openTillSchema>
): Promise<ActionResult<TillSession>> {
  const parsed = openTillSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues[0]?.message ?? 'Invalid input',
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('open_till_session', {
    p_branch_id: parsed.data.branchId,
    p_opening_float: parsed.data.openingFloat,
  })

  if (error) {
    return { ok: false, ...mapRpcError(error) }
  }

  revalidatePath('/app/till')
  return { ok: true, data: data as TillSession }
}

// ─────────────────────────────────────────────────────────────────────────────
// closeTill
// ─────────────────────────────────────────────────────────────────────────────

export async function closeTill(
  input: z.input<typeof closeTillSchema>
): Promise<ActionResult<TillSession>> {
  const parsed = closeTillSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues[0]?.message ?? 'Invalid input',
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('close_till_session', {
    p_session_id: parsed.data.sessionId,
    p_actual_cash_counted: parsed.data.actualCashCounted,
    p_close_mode: parsed.data.closeMode,
    p_notes: parsed.data.notes ?? null,
  })

  if (error) {
    return { ok: false, ...mapRpcError(error) }
  }

  revalidatePath('/app/till')
  return { ok: true, data: data as TillSession }
}

// ─────────────────────────────────────────────────────────────────────────────
// reviewTillSession
// ─────────────────────────────────────────────────────────────────────────────

export async function reviewTillSession(
  input: z.input<typeof reviewTillSchema>
): Promise<ActionResult<TillSession>> {
  const parsed = reviewTillSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues[0]?.message ?? 'Invalid input',
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('review_till_session', {
    p_session_id: parsed.data.sessionId,
    p_decision: parsed.data.decision,
    p_notes: parsed.data.notes ?? null,
  })

  if (error) {
    return { ok: false, ...mapRpcError(error) }
  }

  revalidatePath('/app/till')
  return { ok: true, data: data as TillSession }
}

