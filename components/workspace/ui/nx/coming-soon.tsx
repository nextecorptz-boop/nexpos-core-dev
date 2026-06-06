import * as React from 'react'
import { Icon, type IconName } from './icon'

/**
 * ComingSoon — drop-in placeholder for planned-but-not-yet-shipped modules
 * (Transfers, Expenses, Purchases, Suppliers, Credit, Till, Returns, etc.).
 * Matches the bundle's documented copy pattern:
 *   "{Module} Coming Soon — We're upgrading the {module} module.
 *    This feature will be available shortly."
 * Server-safe.
 */
export interface ComingSoonProps {
  /** Display name of the module, e.g. "Transfers". */
  moduleName: string
  /** Lowercase form used inside the body copy, e.g. "transfers". */
  moduleSlug?: string
  icon?: IconName
  className?: string
}

export function ComingSoon({
  moduleName,
  moduleSlug,
  icon = 'package',
  className = '',
}: ComingSoonProps) {
  const slug = moduleSlug ?? moduleName.toLowerCase()
  return (
    <div className={`nx-coming ${className}`.trim()}>
      <div className="nx-coming-ic">
        <Icon name={icon} size={28} />
      </div>
      <div className="nx-empty-title">{moduleName} Coming Soon</div>
      <div className="nx-empty-sub">
        We&apos;re upgrading the {slug} module. This feature will be available
        shortly.
      </div>
    </div>
  )
}
