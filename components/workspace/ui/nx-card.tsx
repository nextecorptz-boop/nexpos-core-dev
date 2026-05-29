import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface NxCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function NxCard({ children, className, hover = false }: NxCardProps) {
  return (
    <div
      className={cn(
        'bg-nx-surface border border-nx-border rounded-nx-card',
        hover && 'transition-colors hover:border-nx-border/60',
        className
      )}
    >
      {children}
    </div>
  )
}
