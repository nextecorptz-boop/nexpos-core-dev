import * as React from 'react'
import { Chip, Icon, type ChipTone } from '@/components/workspace/ui/nx'
import type { WebhookStatusInfo } from '@/lib/payments/seerbit'

const STATE_META: Record<
  WebhookStatusInfo['state'],
  { label: string; tone: ChipTone }
> = {
  idle:     { label: 'Idle',     tone: 'muted' },
  awaiting: { label: 'Awaiting', tone: 'amber' },
  verified: { label: 'Verified', tone: 'green' },
  failed:   { label: 'Failed',   tone: 'red' },
}

export interface WebhookStatusProps {
  info: WebhookStatusInfo
}

export function WebhookStatus({ info }: WebhookStatusProps) {
  const m = STATE_META[info.state]
  return (
    <div
      className="nx-card"
      style={{
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div className="nx-method-ic">
        <Icon name="webhook" size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
          Endpoint verification
        </div>
        <div
          style={{
            fontFamily: 'var(--nx-font-data)',
            fontSize: 12,
            color: 'var(--nx-text-sec)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {info.endpoint}
        </div>
      </div>
      <Chip tone={m.tone}>{m.label}</Chip>
    </div>
  )
}
