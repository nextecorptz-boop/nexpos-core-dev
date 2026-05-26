'use client'

import React from 'react'

export type StockHealthStatus = 'healthy' | 'low_stock' | 'overstocked' | 'dead_stock' | 'critical'

interface StockBadgeProps {
  status: StockHealthStatus | string
}

export function StockBadge({ status }: StockBadgeProps) {
  const normalizedStatus = (status || '').toLowerCase().replace(' ', '_') as StockHealthStatus

  let classes = 'text-nx-text-muted bg-nx-elevated border-nx-border'
  let label = status

  switch (normalizedStatus) {
    case 'healthy':
      classes = 'text-nx-green bg-nx-green/10 border-nx-green/20'
      label = 'Healthy'
      break
    case 'low_stock':
      classes = 'text-nx-orange bg-nx-orange/10 border-nx-orange/20 font-semibold'
      label = 'Low Stock'
      break
    case 'overstocked':
      classes = 'text-nx-cyan bg-nx-cyan/10 border-nx-cyan/20'
      label = 'Overstocked'
      break
    case 'dead_stock':
      classes = 'text-nx-text-muted bg-nx-elevated border-nx-border'
      label = 'Dead Stock'
      break
    case 'critical':
      classes = 'text-nx-red bg-nx-red/10 border-nx-red/20 font-bold'
      label = 'Out of Stock'
      break
    default:
      label = status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
      break
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider border select-none ${classes}`}>
      {label}
    </span>
  )
}
