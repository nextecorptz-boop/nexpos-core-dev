import * as React from 'react'
import { Chip, Icon } from '@/components/workspace/ui/nx'
import type { ChecklistItem } from '@/lib/payments/seerbit'

export interface ActivationChecklistProps {
  items: ChecklistItem[]
}

/**
 * 5-step activation checklist (business profile → KYC → settlement →
 * test payment → webhook). Pure presentation. The done count is rendered
 * by the parent page header so this component stays self-contained.
 */
export function ActivationChecklist({ items }: ActivationChecklistProps) {
  return (
    <div className="nx-card nx-checklist">
      {items.map((c, i) => (
        <div
          key={c.id}
          className={`nx-check-item${c.state === 'todo' ? ' is-todo' : ''}`}
        >
          <div className={`nx-check-mark ${c.state}`}>
            {c.state === 'done' ? (
              <Icon name="check" size={14} />
            ) : c.state === 'active' ? (
              // small filled dot
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: 'currentColor',
                  display: 'inline-block',
                }}
              />
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
            )}
          </div>
          <span className="nx-check-label">{c.label}</span>
          {c.state === 'active' && <Chip tone="green">Next</Chip>}
          {c.state === 'done' && (
            <Icon name="check" size={16} color="var(--nx-green)" />
          )}
        </div>
      ))}
    </div>
  )
}
