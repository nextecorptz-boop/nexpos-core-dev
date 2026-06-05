import * as React from 'react'
import {
  // Common module + action icons used by banners and the payments surface.
  // Keep this list small and grow it intentionally — Lucide is tree-shakeable
  // when imported by name. (Do not switch to dynamic imports here; the icons
  // render inside Server Components.)
  ArrowRight,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  Check,
  CircleAlert,
  CircleHelp,
  CreditCard,
  Crown,
  Landmark,
  LineChart,
  MessageCircle,
  PlugZap,
  Receipt,
  ScanBarcode,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Webhook,
  X,
  Zap,
  Clock,
  FlaskConical,
  Package,
  type LucideProps,
} from 'lucide-react'

/**
 * Icon registry for the NEXPOS UI kit.
 * Maps the design-bundle string names (kebab-case Lucide ids) to
 * concrete imported components, so primitives can stay declarative
 * (`<Icon name="badge-check" />`) without dynamic require() at runtime.
 *
 * Extend deliberately — do not catch-all auto-import the entire Lucide
 * library (would defeat tree-shaking).
 */
const REGISTRY = {
  'arrow-right': ArrowRight,
  'badge-check': BadgeCheck,
  'boxes': Boxes,
  'check': Check,
  'check-circle': CheckCircle2,
  'circle-alert': CircleAlert,
  'circle-help': CircleHelp,
  'clock': Clock,
  'credit-card': CreditCard,
  'crown': Crown,
  'flask-conical': FlaskConical,
  'landmark': Landmark,
  'line-chart': LineChart,
  'message-circle': MessageCircle,
  'package': Package,
  'plug-zap': PlugZap,
  'receipt': Receipt,
  'scan-barcode': ScanBarcode,
  'shield-check': ShieldCheck,
  'smartphone': Smartphone,
  'triangle-alert': TriangleAlert,
  'webhook': Webhook,
  'x': X,
  'zap': Zap,
} as const

export type IconName = keyof typeof REGISTRY

export interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName
}

/**
 * `<Icon name="badge-check" size={18} />`
 * Returns null silently if the name isn't registered — fail-soft so an
 * unknown banner icon never crashes a Server Component render.
 */
export function Icon({ name, size = 18, strokeWidth = 1.75, ...rest }: IconProps) {
  const Cmp = REGISTRY[name]
  if (!Cmp) return null
  return <Cmp size={size} strokeWidth={strokeWidth} {...rest} />
}
