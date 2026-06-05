import * as React from 'react'

/**
 * NEXPOS status chip.
 * Tone-driven small pill — used for stock states, payment statuses, banners.
 * SSR-safe: pure styled span, no client hooks.
 */
export type ChipTone =
  | 'default'
  | 'muted'
  | 'green'
  | 'amber'
  | 'red'
  | 'gold'
  | 'pink'

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone
}

export function Chip({ tone = 'default', className = '', children, ...rest }: ChipProps) {
  const toneClass = tone === 'default' ? '' : tone
  return (
    <span className={`nx-chip ${toneClass} ${className}`.trim()} {...rest}>
      {children}
    </span>
  )
}
