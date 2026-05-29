import { cn } from '@/lib/utils'

interface NxSectionLabelProps {
  children: string
  className?: string
}

export function NxSectionLabel({ children, className }: NxSectionLabelProps) {
  return (
    <p className={cn('text-[10px] font-bold text-nx-text-muted uppercase tracking-widest select-none', className)}>
      {children}
    </p>
  )
}
