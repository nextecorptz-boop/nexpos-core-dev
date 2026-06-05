/**
 * Pure eligibility logic for NEXPOS dashboard lifecycle banners.
 * No DB, no I/O — takes a state snapshot + dismissed list and returns the
 * banners to show. Easy to unit-test and re-run on the client when the
 * user dismisses something.
 *
 * Priority ordering (lowest number = highest priority):
 *   1. critical-setup   — anything that blocks normal operation
 *   2. seerbit          — payment activation
 *   3. inventory        — first-products / missing stock data
 *   4. insights         — once meaningful sales exist
 *   5. social           — social-commerce nudge
 *   6. upgrade          — only after meaningful engagement
 *
 * Rail caps at 3 active banners at a time. "Done" status cards are
 * separate (not subject to the cap) and serve as compact recaps.
 */

import {
  BANNER_DEFS,
  type BannerBusinessState,
  type BannerId,
} from './defs'

export interface EligibleBanner {
  id: BannerId
  priority: number
}

export interface EligibleResult {
  active: EligibleBanner[]
  done: EligibleBanner[]
}

/** How many banners the rail will render simultaneously. */
export const MAX_ACTIVE_BANNERS = 3

export interface EligibilityOptions {
  /**
   * Used to honor `reappear_after` cool-downs. Pass a Date so tests can
   * inject a clock. Defaults to `new Date()`.
   */
  now?: Date
  /**
   * Map of bannerId → reappear_after timestamp (string or Date).
   * Banners whose reappear_after is in the future are treated as dismissed.
   * Banners with a null reappear_after are treated as permanent dismissals.
   */
  reappearAfter?: Partial<Record<BannerId, string | Date | null>>
}

function isDismissed(
  id: BannerId,
  dismissedIds: BannerId[],
  opts: EligibilityOptions,
): boolean {
  if (!dismissedIds.includes(id)) return false
  const ra = opts.reappearAfter?.[id]
  if (ra == null) return true // permanent dismissal
  const reappearAt = ra instanceof Date ? ra : new Date(ra)
  if (Number.isNaN(reappearAt.getTime())) return true
  const now = opts.now ?? new Date()
  // Dismissed only while now < reappearAt; once passed, banner can re-surface.
  return now < reappearAt
}

/**
 * Compute which lifecycle banners should be shown right now.
 *
 *  - Critical setup wins over everything if flagged via `state.missingStockCount`
 *    being negative as a sentinel — see TODO. (Not used in Phase A–D; the
 *    branch is reserved for a future "blocker" surface.)
 *  - SeerBit is "complete" only when LIVE + webhook verified + settlement
 *    account added + at least one successful live payment.
 *  - Inventory is "complete" when >=5 products tracked and no missing
 *    stock data.
 */
export function getEligibleBanners(
  state: BannerBusinessState = {},
  dismissedIds: BannerId[] = [],
  options: EligibilityOptions = {},
): EligibleResult {
  const {
    seerbitStatus = 'not-connected',
    webhookVerified = false,
    settlementAdded = false,
    successfulLivePayments = 0,
    productCount = 0,
    missingStockCount = 0,
    lowStockCount = 0,
    salesCount = 0,
    reportsOpened = false,
    socialOrdersCount = 0,
    planUsage = 0,
  } = state

  const active: EligibleBanner[] = []
  const done: EligibleBanner[] = []

  /* 1 — critical-setup: reserved hook. Currently never auto-fires; will be
     wired to a tenant-level "setup_blocked" flag in a later phase. */

  /* 2 — SeerBit payment activation */
  const seerbitComplete =
    seerbitStatus === 'live' &&
    webhookVerified &&
    settlementAdded &&
    successfulLivePayments > 0
  if (seerbitComplete) {
    done.push({ id: 'seerbit', priority: 2 })
  } else if (!isDismissed('seerbit', dismissedIds, options)) {
    active.push({ id: 'seerbit', priority: 2 })
  }

  /* 3 — Inventory setup. "Done" branch surfaces a stock-recap status card
     only when there's at least one low-stock signal worth highlighting. */
  const invComplete = productCount >= 5 && missingStockCount === 0
  if (invComplete) {
    if (lowStockCount > 0) done.push({ id: 'inventory', priority: 3 })
  } else if (!isDismissed('inventory', dismissedIds, options)) {
    active.push({ id: 'inventory', priority: 3 })
  }

  /* 4 — Insights nudge: only once meaningful sales exist AND user has not
     opened Reports yet. */
  if (
    salesCount >= 3 &&
    !reportsOpened &&
    !isDismissed('insights', dismissedIds, options)
  ) {
    active.push({ id: 'insights', priority: 4 })
  }

  /* 5 — Social commerce nudge */
  if (
    socialOrdersCount === 0 &&
    !isDismissed('social', dismissedIds, options)
  ) {
    active.push({ id: 'social', priority: 5 })
  }

  /* 6 — Upgrade. Only after meaningful engagement (planUsage is a
     0-N counter representing major-feature usage). */
  if (planUsage >= 3 && !isDismissed('upgrade', dismissedIds, options)) {
    active.push({ id: 'upgrade', priority: 6 })
  }

  active.sort((a, b) => a.priority - b.priority)
  return {
    active: active.slice(0, MAX_ACTIVE_BANNERS),
    done,
  }
}

/** Sanity: every BANNER_ID referenced above maps to a real BANNER_DEFS entry. */
;(function _assertDefsCoverage() {
  const ids = new Set<BannerId>(['seerbit', 'inventory', 'insights', 'social', 'upgrade'])
  for (const id of ids) {
    if (!(id in BANNER_DEFS)) {
      throw new Error(`Banner id "${id}" referenced in eligibility but missing in BANNER_DEFS`)
    }
  }
})()
