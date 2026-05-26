'use client'

import React from 'react'

export type OperationalStatus = 'completed' | 'pending' | 'processing' | 'cancelled' | 'refunded'

interface StatusPillProps {
  status: OperationalStatus | string
}

export function StatusPill({ status }: StatusPillProps) {
  const normalizedStatus = (status || '').toLowerCase() as OperationalStatus

  let classes = 'text-nx-text-muted bg-nx-elevated border-nx-border'
  let label = status

  switch (normalizedStatus) {
    case 'completed':
      classes = 'text-nx-green bg-nx-green/10 border-nx-green/20'
      label = 'Completed'
      break
    case 'pending':
      classes = 'text-nx-orange bg-nx-orange/10 border-nx-orange/20'
      label = 'Pending'
      break
    case 'processing':
      classes = 'text-nx-cyan bg-nx-cyan/10 border-nx-cyan/20'
      label = 'Processing'
      break
    case 'cancelled':
      classes = 'text-nx-red bg-nx-red/10 border-nx-red/20'
      label = 'Cancelled'
      break
    case 'refunded':
      classes = 'text-nx-text-muted bg-nx-text-muted/10 border-nx-border'
      label = 'Refunded'
      break
    default:
      // Handle db direct strings safely
      if (normalizedStatus === 'partial') {
        classes = 'text-nx-orange bg-nx-orange/10 border-nx-orange/20'
        label = 'Pending'
      } else {
        label = status.charAt(0).toUpperCase() + status.slice(1)
      }
      break
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-semibold tracking-wide border uppercase select-none ${classes}`}>
      {label}
    </span>
  )
}
