import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface NxPageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function NxPageHeader({ title, subtitle, actions, className }: NxPageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-8 pt-6 select-none', className)}>
      <div>
        <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3] mb-1">{title}</h1>
        {subtitle && (
          <p className="text-nx-text-sec text-[12px]">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  )
}
