import { cn } from '@/lib/utils'

interface NxProgressBarProps {
  value: number
  max?: number
  color?: 'cyan' | 'gold' | 'green' | 'red' | 'orange'
  className?: string
  trackClassName?: string
}

const colorMap = {
  cyan: 'bg-nx-cyan',
  gold: 'bg-nx-gold',
  green: 'bg-nx-green',
  red: 'bg-nx-red',
  orange: 'bg-nx-orange',
}

export function NxProgressBar({
  value,
  max = 100,
  color = 'cyan',
  className,
  trackClassName,
}: NxProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={cn('w-full h-1.5 bg-nx-elevated rounded-full overflow-hidden', trackClassName)}>
      <div
        className={cn('h-full rounded-full transition-all duration-300', colorMap[color], className)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
