'use client'

import React from 'react'

export type VelocityType = 'high' | 'moderate' | 'slow'
export type RiskType = 'low_stock' | 'dead_stock' | 'fast_moving' | 'overstocked' | 'normal'

interface PerformanceIndicatorProps {
  type: 'velocity' | 'risk'
  value: VelocityType | RiskType | string
}

export function PerformanceIndicator({ type, value }: PerformanceIndicatorProps) {
  const normalizedValue = (value || '').toLowerCase().replace(' ', '_')

  let classes = 'text-nx-text-sec bg-nx-elevated border-nx-border'
  let label = value

  if (type === 'velocity') {
    switch (normalizedValue) {
      case 'high':
      case 'high_performer':
        classes = 'text-nx-cyan bg-nx-cyan/10 border-nx-cyan/25'
        label = 'High Performer'
        break
      case 'moderate':
        classes = 'text-nx-text bg-nx-hover/40 border-nx-border'
        label = 'Moderate'
        break
      case 'slow':
      case 'slow_moving':
        classes = 'text-nx-text-muted bg-nx-elevated/40 border-nx-border/50'
        label = 'Slow Moving'
        break
      default:
        label = value.charAt(0).toUpperCase() + value.slice(1)
        break
    }
  } else if (type === 'risk') {
    switch (normalizedValue) {
      case 'low_stock':
        classes = 'text-nx-red bg-nx-red/10 border-nx-red/25 font-bold'
        label = 'Low Stock'
        break
      case 'dead_stock':
        classes = 'text-nx-text-muted bg-nx-elevated border-nx-border'
        label = 'Dead Stock'
        break
      case 'fast_moving':
        classes = 'text-nx-cyan bg-nx-cyan/15 border-nx-cyan/20'
        label = 'Fast Moving'
        break
      case 'overstocked':
        classes = 'text-nx-orange bg-nx-orange/10 border-nx-orange/20'
        label = 'Overstocked'
        break
      case 'normal':
        classes = 'text-nx-green bg-nx-green/10 border-nx-green/20'
        label = 'Healthy'
        break
      default:
        label = value.replace('_', ' ').charAt(0).toUpperCase() + value.slice(1)
        break
    }
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-semibold uppercase tracking-wide border select-none ${classes}`}>
      {label}
    </span>
  )
}
