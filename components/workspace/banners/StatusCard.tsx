import * as React from 'react'
import Link from 'next/link'
import { Icon, ModTile } from '@/components/workspace/ui/nx'
import {
  BANNER_DEFS,
  type BannerBusinessState,
  type BannerId,
} from '@/lib/banners/defs'

const ROUTE_MAP: Record<string, string> = {
  payments: '/app/payments',
  products: '/app/products',
  inventory: '/app/inventory',
  reports: '/app/reports',
  settings: '/app/settings',
}

export interface StatusCardProps {
  id: BannerId
  bizState: BannerBusinessState
}

/**
 * Compact "recap" card shown once a banner's goal is met (e.g. SeerBit live,
 * inventory tracked). Renders only when the def declares a `done` variant.
 */
export function StatusCard({ id, bizState }: StatusCardProps) {
  const def = BANNER_DEFS[id]
  if (!def?.done) return null

  const title =
    typeof def.done.title === 'function' ? def.done.title(bizState) : def.done.title
  if (!title) return null

  const href = ROUTE_MAP[def.done.go]
  if (!href) return null

  return (
    <div className="nx-status-card">
      <ModTile mod={def.done.mod} size="sm">
        <Icon name={def.done.icon} size={16} />
      </ModTile>
      <div className="nx-status-text">{title}</div>
      <Link className="nx-status-cta" href={href}>
        {def.done.cta} <Icon name="arrow-right" size={13} />
      </Link>
    </div>
  )
}
