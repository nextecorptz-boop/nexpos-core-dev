import * as React from 'react'
import { Chip, Icon } from '@/components/workspace/ui/nx'
import type { PaymentMethodCard } from '@/lib/payments/seerbit'

export interface PaymentMethodsListProps {
  methods: PaymentMethodCard[]
}

export function PaymentMethodsList({ methods }: PaymentMethodsListProps) {
  return (
    <div className="nx-card nx-list">
      {methods.map((m) => (
        <div className="nx-method-row" key={m.id}>
          <div
            className="nx-method-ic"
            style={m.enabled ? { color: 'var(--nx-green)' } : undefined}
          >
            <Icon name={m.icon} size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{m.label}</div>
            <div
              style={{ fontSize: 11.5, color: 'var(--nx-text-sec)', marginTop: 2 }}
            >
              {m.sub}
            </div>
          </div>
          <Chip tone={m.enabled ? 'green' : 'muted'}>
            {m.enabled ? 'Enabled' : 'Off'}
          </Chip>
        </div>
      ))}
    </div>
  )
}
