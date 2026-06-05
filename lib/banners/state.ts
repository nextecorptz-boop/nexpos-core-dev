/**
 * Server-side fetcher for the lifecycle-banner business state + the current
 * user's dismissals. Uses Supabase HEAD count queries (no row payload) where
 * possible so the dashboard render cost stays flat.
 *
 * RLS-aware: this runs through the per-request server client, so the
 * authenticated user only sees their own tenant's counts and dismissals.
 *
 * Fields we don't yet have a source for (seerbitStatus, webhookVerified,
 * settlementAdded, successfulLivePayments, reportsOpened, socialOrdersCount,
 * planUsage) are returned as safe defaults — see TODOs.
 */

import { createClient } from '@/lib/supabase/server'
import type { BannerBusinessState } from './defs'
import type { BannerId } from './defs'

export interface DismissalRow {
  banner_id: BannerId
  dismissed_at: string
  reappear_after: string | null
}

export interface BannerSnapshot {
  state: BannerBusinessState
  dismissedIds: BannerId[]
  reappearAfter: Partial<Record<BannerId, string | null>>
}

/**
 * Fetch everything needed to evaluate banner eligibility on the server.
 * Returns safe defaults if the user is unauthenticated or any single
 * counter query fails — banners must never crash the dashboard.
 */
export async function loadBannerSnapshot(): Promise<BannerSnapshot> {
  const supabase = await createClient()

  // Fire counts in parallel; each one returns `null` on error so we can
  // degrade gracefully.
  const [
    productCountRes,
    lowStockRes,
    missingStockRes,
    salesCountRes,
    dismissalsRes,
  ] = await Promise.all([
    supabase
      .from('product_families')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    // Low stock = on_hand <= reorder_point AND reorder_point > 0.
    // We approximate with `lte('on_hand', 'reorder_point')` not supported
    // directly, so use the cheaper "on_hand <= 5" floor as a placeholder.
    // TODO(banners): replace with a SQL view / RPC that computes low_stock
    // properly against reorder_point.
    supabase
      .from('stock_levels')
      .select('*', { count: 'exact', head: true })
      .lte('on_hand', 5),
    // Missing stock = a variant exists with no stock_levels row at all.
    // Cheap proxy: count variants whose on_hand is exactly 0.
    // TODO(banners): replace with a left-join view to identify variants
    // with zero rows in stock_levels (truly missing) vs. zeroed inventory.
    supabase
      .from('stock_levels')
      .select('*', { count: 'exact', head: true })
      .eq('on_hand', 0),
    supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed'),
    supabase
      .from('user_banner_dismissals')
      .select('banner_id, dismissed_at, reappear_after'),
  ])

  const productCount = productCountRes.count ?? 0
  const lowStockCount = lowStockRes.count ?? 0
  const missingStockCount = missingStockRes.count ?? 0
  const salesCount = salesCountRes.count ?? 0

  const dismissedIds: BannerId[] = []
  const reappearAfter: Partial<Record<BannerId, string | null>> = {}
  const rows = (dismissalsRes.data ?? []) as DismissalRow[]
  for (const r of rows) {
    dismissedIds.push(r.banner_id)
    reappearAfter[r.banner_id] = r.reappear_after
  }

  // TODO(banners-seerbit): once a tenant_payment_provider table exists,
  // read the real status, webhook + settlement flags, and successful-live
  // payment count. For Phase D the surface defaults to 'not-connected'.
  // TODO(banners-reports): wire a `reports_opened_at` flag (per user or
  // per tenant) so the Insights nudge can retire itself.
  // TODO(banners-social): track social-channel order count once Orders
  // module ships.
  // TODO(banners-plan-usage): drive planUsage from a tenant feature-usage
  // counter so the Upgrade banner only fires after meaningful engagement.

  return {
    state: {
      seerbitStatus: 'not-connected',
      webhookVerified: false,
      settlementAdded: false,
      successfulLivePayments: 0,
      productCount,
      missingStockCount,
      lowStockCount,
      salesCount,
      reportsOpened: false,
      socialOrdersCount: 0,
      planUsage: 0,
    },
    dismissedIds,
    reappearAfter,
  }
}
