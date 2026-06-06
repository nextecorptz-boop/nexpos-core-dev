import * as React from 'react'
import { Chip, type ChipTone } from './chip'

/**
 * StockChip — renders inventory-aware stock status copy + tone.
 *  - <= 0     → red "Out of stock"
 *  - <= lowAt → amber "{n} left" (low stock signal)
 *  - else     → muted "{n} in stock"
 */
export interface StockChipProps {
  quantity: number
  /** Threshold at or below which stock is considered low. Default 5. */
  lowAt?: number
  className?: string
}

export function StockChip({ quantity, lowAt = 5, className }: StockChipProps) {
  let tone: ChipTone = 'muted'
  let label: string = `${quantity} in stock`

  if (quantity <= 0) {
    tone = 'red'
    label = 'Out of stock'
  } else if (quantity <= lowAt) {
    tone = 'amber'
    label = `${quantity} left`
  }

  return (
    <Chip tone={tone} className={className}>
      {label}
    </Chip>
  )
}
