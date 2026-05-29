import { cn } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NxKpiCardProps {
  label: string
  value: string
  icon: LucideIcon
  iconColor?: 'cyan' | 'gold' | 'green' | 'red'
  trend?: { direction: 'up' | 'down'; label: string }
  className?: string
}

const iconColorMap = {
  cyan: 'bg-nx-cyan/10 text-nx-cyan',
  gold: 'bg-nx-gold/10 text-nx-gold',
  green: 'bg-nx-green/10 text-nx-green',
  red: 'bg-nx-red/10 text-nx-red',
}

export function NxKpiCard({
  label,
  value,
  icon: Icon,
  iconColor = 'cyan',
  trend,
  className,
}: NxKpiCardProps) {
  return (
    <div
      className={cn(
        'bg-nx-surface border border-nx-border rounded-nx-card p-5 transition-colors hover:border-nx-border/60',
        className
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-[38px] h-[38px] rounded-[8px] flex items-center justify-center', iconColorMap[iconColor])}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="font-ui text-[12px] text-nx-text-sec font-medium">{label}</p>
      </div>

      <div className="font-data text-[20px] font-bold text-nx-text mb-1">{value}</div>

      {trend && (
        <div className={cn('flex items-center text-[12px] font-medium', trend.direction === 'up' ? 'text-nx-green' : 'text-nx-red')}>
          {trend.direction === 'up' ? (
            <ArrowUpRight className="w-3 h-3 mr-1" />
          ) : (
            <ArrowDownRight className="w-3 h-3 mr-1" />
          )}
          <span>{trend.label}</span>
        </div>
      )}
    </div>
  )
}
