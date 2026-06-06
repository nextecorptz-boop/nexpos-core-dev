import * as React from 'react'

/**
 * Module icon tile (NEXPOS Selcom-rhythm "action grid" style).
 * Color is data-driven via the `data-mod` attribute, which CSS
 * (`.nx-modtile[data-mod="..."]`) maps to a --mod-* token.
 * Falls back to neutral text-sec if `mod` is omitted.
 *
 * Size variants: 'sm' (38px) | default (44px) | 'lg' (54px).
 */
export type ModuleKind =
  | 'pos'
  | 'inventory'
  | 'products'
  | 'customers'
  | 'credit'
  | 'till'
  | 'returns'
  | 'reports'
  | 'orders'
  | 'suppliers'
  | 'transfers'
  | 'expenses'
  | 'control'
  | 'security'
  | 'settings'
  | 'alerts'

export interface ModTileProps extends React.HTMLAttributes<HTMLSpanElement> {
  mod?: ModuleKind
  size?: 'sm' | 'md' | 'lg'
  active?: boolean
  disabled?: boolean
}

export function ModTile({
  mod,
  size = 'md',
  active = false,
  disabled = false,
  className = '',
  children,
  ...rest
}: ModTileProps) {
  const sizeClass = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : ''
  const stateClass = [active && 'is-active', disabled && 'is-disabled']
    .filter(Boolean)
    .join(' ')
  return (
    <span
      className={`nx-modtile ${sizeClass} ${stateClass} ${className}`.trim()}
      data-mod={mod}
      {...rest}
    >
      {children}
    </span>
  )
}
