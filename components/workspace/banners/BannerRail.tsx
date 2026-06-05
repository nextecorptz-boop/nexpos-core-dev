'use client'

import * as React from 'react'
import { Banner } from './Banner'
import { StatusCard } from './StatusCard'
import {
  getEligibleBanners,
  MAX_ACTIVE_BANNERS,
} from '@/lib/banners/eligibility'
import type { BannerBusinessState, BannerId } from '@/lib/banners/defs'
import { dismissBanner } from '@/lib/banners/actions'

export interface BannerRailProps {
  /** Snapshot computed on the server. */
  bizState: BannerBusinessState
  /** Banner ids already dismissed (resolved from Supabase on the server). */
  initialDismissed: BannerId[]
  /** Optional reappear-after map (string ISO or null) keyed by banner id. */
  initialReappear?: Partial<Record<BannerId, string | null>>
}

/**
 * Client wrapper that:
 *  1. Computes active + done banners on first render using server-supplied
 *     state, so SSR markup matches the eventual client tree (no hydration
 *     flicker).
 *  2. Lets the user optimistically dismiss a banner — we update local state
 *     and call the server action in the background.
 *
 * Rail caps active banners at MAX_ACTIVE_BANNERS (3). Done cards are listed
 * below the rail and are not subject to the cap.
 */
export function BannerRail({
  bizState,
  initialDismissed,
  initialReappear = {},
}: BannerRailProps) {
  const [dismissed, setDismissed] = React.useState<BannerId[]>(initialDismissed)

  const { active, done } = React.useMemo(
    () =>
      getEligibleBanners(bizState, dismissed, {
        reappearAfter: initialReappear,
      }),
    [bizState, dismissed, initialReappear],
  )

  const onClose = React.useCallback((id: BannerId) => {
    setDismissed((prev) => (prev.includes(id) ? prev : [...prev, id]))
    void dismissBanner(id)
  }, [])

  if (active.length === 0 && done.length === 0) return null

  return (
    <div className="nx-banner-system" aria-label="NEXPOS guidance">
      {active.length > 0 && (
        <div
          className="nx-banner-rail"
          role="region"
          aria-label={`${active.length} of ${MAX_ACTIVE_BANNERS} guidance cards`}
        >
          {active.map((b) => (
            <Banner key={b.id} id={b.id} onClose={onClose} />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div className="nx-status-cards">
          {done.map((b) => (
            <StatusCard key={b.id} id={b.id} bizState={bizState} />
          ))}
        </div>
      )}
    </div>
  )
}
