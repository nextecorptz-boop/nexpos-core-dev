'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './icon'

/**
 * Lightweight toast primitive aligned with NEXPOS visual tokens.
 * Auto-dismisses after `durationMs` (default 2400ms). Renders in a portal.
 * For app-wide queueing, layer this under a context provider in a later phase.
 */
export interface ToastProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  icon?: IconName
  durationMs?: number
}

export function Toast({
  open,
  onClose,
  title,
  description,
  icon = 'check-circle',
  durationMs = 2400,
}: ToastProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const t = window.setTimeout(onClose, durationMs)
    return () => window.clearTimeout(t)
  }, [open, durationMs, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div className="nx-toast" role="status" aria-live="polite">
      <Icon name={icon} size={18} color="var(--nx-green)" />
      <div>
        <div>{title}</div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--nx-text-sec)', fontWeight: 500 }}>
            {description}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
