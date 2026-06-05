/**
 * Shared types + presentation maps for the NEXPOS SeerBit payments surface.
 * This phase is UI/state architecture only — no SeerBit API calls happen
 * here, and there is no secret-key handling.
 *
 * The state model intentionally mirrors what the bundle's `screens-payments`
 * prototype encoded, so the eventual server-side integration can drive the
 * same UI without prop-shape changes.
 */

import type { ChipTone, IconName } from '@/components/workspace/ui/nx'

/** Connection lifecycle states a SeerBit-backed tenant can be in. */
export type SeerbitStatus =
  | 'not_connected'
  | 'test_mode'
  | 'live_pending_kyc'
  | 'live_active'
  | 'error'

/** Transaction lifecycle states surfaced in the recent-payments list. */
export type TxnState =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'

/** Checklist row state — `done` ✓, `active` (next-up), `todo` (pending). */
export type ChecklistState = 'done' | 'active' | 'todo'

export interface SeerbitStatusMeta {
  label: string
  chip: ChipTone
  icon: IconName
  /** Whether this state should render the inline error banner. */
  isError?: boolean
}

export const SEERBIT_STATUS_META: Record<SeerbitStatus, SeerbitStatusMeta> = {
  not_connected: {
    label: 'Not connected',
    chip: 'muted',
    icon: 'plug-zap',
  },
  test_mode: {
    label: 'Test mode',
    chip: 'gold',
    icon: 'flask-conical',
  },
  live_pending_kyc: {
    label: 'Live pending KYC',
    chip: 'amber',
    icon: 'clock',
  },
  live_active: {
    label: 'Live active',
    chip: 'green',
    icon: 'badge-check',
  },
  error: {
    label: 'Error',
    chip: 'red',
    icon: 'triangle-alert',
    isError: true,
  },
}

export const TXN_STATE_META: Record<TxnState, { label: string; chip: ChipTone }> = {
  pending:   { label: 'Pending',   chip: 'amber' },
  paid:      { label: 'Paid',      chip: 'green' },
  failed:    { label: 'Failed',    chip: 'red' },
  cancelled: { label: 'Cancelled', chip: 'muted' },
  refunded:  { label: 'Refunded',  chip: 'muted' },
}

export interface ChecklistItem {
  /** Stable id used for analytics + keying. */
  id:
    | 'business_profile'
    | 'kyc_submitted'
    | 'settlement_added'
    | 'test_payment'
    | 'webhook_verified'
  label: string
  state: ChecklistState
}

/**
 * Default checklist for the `not_connected` Phase-D state.
 * The eventual server-driven version will accept this shape from a Supabase
 * row keyed by tenant_id.
 */
export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'business_profile', label: 'Business profile completed', state: 'todo' },
  { id: 'kyc_submitted',    label: 'KYC submitted',              state: 'todo' },
  { id: 'settlement_added', label: 'Settlement account added',   state: 'todo' },
  { id: 'test_payment',     label: 'Test payment completed',     state: 'todo' },
  { id: 'webhook_verified', label: 'Webhook verified',           state: 'todo' },
]

export interface PaymentMethodCard {
  id: 'mobile_money' | 'card' | 'bank_transfer'
  icon: IconName
  label: string
  sub: string
  enabled: boolean
}

export const DEFAULT_METHODS: PaymentMethodCard[] = [
  { id: 'mobile_money', icon: 'smartphone',  label: 'Mobile Money',  sub: 'M-Pesa · Tigo Pesa · Airtel', enabled: false },
  { id: 'card',         icon: 'credit-card', label: 'Card',          sub: 'Visa · Mastercard',          enabled: false },
  { id: 'bank_transfer',icon: 'landmark',    label: 'Bank Transfer', sub: 'Online checkout',            enabled: false },
]

export interface WebhookStatusInfo {
  endpoint: string
  state: 'awaiting' | 'verified' | 'failed' | 'idle'
}

export const DEFAULT_WEBHOOK: WebhookStatusInfo = {
  endpoint: 'nexpos.co.tz/api/seerbit/hook',
  state: 'idle',
}
