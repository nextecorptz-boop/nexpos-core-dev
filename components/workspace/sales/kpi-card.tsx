'use client'

import React from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface KPICardProps {
  title: string
  value: number | string
  unit?: string
  icon: any
  delta?: number | string
  deltaType?: 'up' | 'down' | 'neutral'
  isGold?: boolean
}

export function KPICard({
  title,
  value,
  unit = '',
  icon: Icon,
  delta,
  deltaType = 'up',
  isGold = false
}: KPICardProps) {
  // Format numeric values
  const formattedValue = typeof value === 'number' 
    ? new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0 }).format(value)
    : value

  const iconBgClass = isGold ? 'bg-nx-gold/10' : 'bg-nx-cyan/10'
  const iconColorClass = isGold ? 'text-nx-gold' : 'text-nx-cyan'
  const borderClass = isGold ? 'hover:border-nx-gold/40' : 'hover:border-nx-cyan/40'

  return (
    <div className={`bg-nx-surface border border-nx-border rounded-nx-card p-5 transition-all duration-200 select-none ${borderClass}`}>
      <div className="flex items-center gap-3 mb-3">
        {/* Icon in 38x38px tinted circle with 8px (md) radius */}
        <div className={`w-[38px] h-[38px] rounded-[8px] flex items-center justify-center shrink-0 ${iconBgClass}`}>
          <Icon className={`w-5 h-5 ${iconColorClass}`} />
        </div>
        <p className="font-ui text-[12px] text-nx-text-sec font-medium">{title}</p>
      </div>

      <div className="flex items-baseline gap-1 mb-1">
        {/* Value in 22px JetBrains Mono (font-data) */}
        <span className="font-data text-[22px] font-bold text-nx-text tracking-tight">
          {formattedValue}
        </span>
        {unit && (
          <span className="font-ui text-[11px] text-nx-text-muted uppercase font-medium">
            {unit}
          </span>
        )}
      </div>

      {delta !== undefined && (
        <div className="flex items-center text-[12px] font-semibold">
          {deltaType === 'up' ? (
            <span className="text-nx-green flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              {delta}%
            </span>
          ) : deltaType === 'down' ? (
            <span className="text-nx-red flex items-center">
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              {delta}%
            </span>
          ) : (
            <span className="text-nx-text-muted">
              {delta}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
