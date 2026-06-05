'use client'

import * as React from 'react'
import Link from 'next/link'
import { Icon } from '@/components/workspace/ui/nx'
import { BANNER_DEFS, type BannerId } from '@/lib/banners/defs'
import { dismissBanner } from '@/lib/banners/actions'

const ROUTE_MAP: Record<string, string | null> = {
  payments: '/app/payments',
  products: '/app/products',
  inventory: '/app/inventory',
  reports: '/app/reports',
  settings: '/app/settings',
}

export interface BannerProps {
  id: BannerId
  /** Optional inline close handler — defaults to the dismiss server action. */
  onClose?: (id: BannerId) => void
}

/**
 * Single growth-card banner. Renders the def's icon/title/sub/cta and a
 * dismiss button that persists the dismissal through the
 * `dismissBanner` server action (RLS scoped to user + tenant).
 */
export function Banner({ id, onClose }: BannerProps) {
  const def = BANNER_DEFS[id]
  const [busy, setBusy] = React.useState(false)

  if (!def) return null

  const ctaHref = def.go ? ROUTE_MAP[def.go] ?? null : null

  async function handleDismiss() {
    if (busy) return
    setBusy(true)
    if (onClose) {
      onClose(id)
    } else {
      try {
        await dismissBanner(id)
      } catch {
        // Network failures are non-fatal — the next dashboard load will
        // re-evaluate eligibility against persisted state.
      }
    }
    setBusy(false)
  }

  const CtaTag = ctaHref ? Link : ('button' as const)
  const ctaProps: Record<string, unknown> = ctaHref
    ? { href: ctaHref }
    : { type: 'button' }

  return (
    <div className={`nx-banner ${def.kind}`}>
      <div className="nx-banner-glow" aria-hidden="true" />
      <button
        className="nx-banner-close"
        aria-label="Dismiss"
        onClick={handleDismiss}
        disabled={busy}
      >
        <Icon name="x" size={14} />
      </button>
      <div className="nx-banner-ic">
        <Icon name={def.icon} size={20} />
      </div>
      <div className="nx-banner-title">{def.title}</div>
      <div className="nx-banner-sub">{def.sub}</div>
      {/* @ts-expect-error — runtime-resolved polymorphic tag (Link | button) */}
      <CtaTag className="nx-banner-cta" {...ctaProps}>
        {def.cta} <Icon name="arrow-right" size={15} />
      </CtaTag>
    </div>
  )
}
