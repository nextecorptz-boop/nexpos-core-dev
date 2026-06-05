import * as React from 'react'
import { Chip, Icon } from '@/components/workspace/ui/nx'
import {
  SEERBIT_STATUS_META,
  type SeerbitStatus,
} from '@/lib/payments/seerbit'

export interface SeerBitProviderCardProps {
  status: SeerbitStatus
}

/**
 * Provider header card for the Payments page.
 * Renders the SeerBit logo + tagline + a tone-correct status chip,
 * and inlines an error banner when status === 'error'.
 */
export function SeerBitProviderCard({ status }: SeerBitProviderCardProps) {
  const meta = SEERBIT_STATUS_META[status]
  return (
    <div className="nx-card" style={{ overflow: 'hidden' }}>
      <div className="nx-provider">
        <div className="nx-provider-logo">
          <Icon name="credit-card" size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nx-h3">SeerBit</div>
          <div className="nx-body-sm">Payment gateway · NEXPOS Pay</div>
        </div>
        <Chip tone={meta.chip}>
          <Icon name={meta.icon} size={11} /> {meta.label}
        </Chip>
      </div>
      {meta.isError && (
        <div style={{ padding: '0 16px 16px' }}>
          <div
            className="nx-card"
            style={{
              background: 'var(--nx-red-tint)',
              borderColor: 'rgba(241,73,63,0.30)',
              padding: '12px 14px',
              display: 'flex',
              gap: 10,
              boxShadow: 'none',
            }}
          >
            <Icon name="triangle-alert" size={16} color="var(--nx-red)" />
            <div className="nx-body-sm" style={{ color: 'var(--nx-text)' }}>
              Settlement sync failed. Re-verify your account.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
