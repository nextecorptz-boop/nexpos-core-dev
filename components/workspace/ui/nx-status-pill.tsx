import { cn } from '@/lib/utils'

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface NxStatusPillProps {
  label: string
  variant?: StatusVariant
  dot?: boolean
  className?: string
}

const variantMap: Record<StatusVariant, string> = {
  success: 'bg-nx-green/10 text-nx-green border-nx-green/20',
  warning: 'bg-nx-orange/10 text-nx-orange border-nx-orange/20',
  error: 'bg-nx-red/10 text-nx-red border-nx-red/20',
  info: 'bg-nx-cyan/10 text-nx-cyan border-nx-cyan/20',
  neutral: 'bg-nx-elevated text-nx-text-sec border-nx-border',
}

const dotColorMap: Record<StatusVariant, string> = {
  success: 'bg-nx-green',
  warning: 'bg-nx-orange',
  error: 'bg-nx-red',
  info: 'bg-nx-cyan',
  neutral: 'bg-nx-text-muted',
}

export function NxStatusPill({ label, variant = 'neutral', dot = false, className }: NxStatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border',
        variantMap[variant],
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColorMap[variant])} />}
      {label}
    </span>
  )
}
