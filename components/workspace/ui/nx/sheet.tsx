'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'

/**
 * Sheet — NEXPOS shared bottom-sheet primitive.
 * Scrim + slide-up panel. One shared pattern for variant select, checkout,
 * receipt etc. Uses CSS animation tokens; respects prefers-reduced-motion.
 *
 * Client-only because it portals to document.body and listens for Escape.
 */
export interface SheetProps {
  open: boolean
  onClose: () => void
  /** Optional accessible label for the dialog */
  ariaLabel?: string
  children: React.ReactNode
}

export function Sheet({ open, onClose, ariaLabel, children }: SheetProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <>
      <div
        className="nx-sheet-scrim"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="nx-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className="nx-sheet-handle" aria-hidden="true" />
        {children}
      </div>
    </>,
    document.body
  )
}
