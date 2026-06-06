import * as React from 'react'
import { Icon, type IconName } from './icon'

/**
 * EmptyState — standard "no data yet" pattern.
 * Server-safe. Compose freely under any list / table that may be empty.
 */
export interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon = 'package',
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`nx-empty ${className}`.trim()}>
      <div className="nx-empty-ic">
        <Icon name={icon} size={24} />
      </div>
      <div className="nx-empty-title">{title}</div>
      {description && <div className="nx-empty-sub">{description}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}
