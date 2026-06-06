/**
 * NEXPOS lifecycle banner definitions.
 * Static enum + content table — kept in code (no DB row) so banner copy,
 * priority, and routing live next to the components that render them.
 *
 * If you add a new banner:
 *   1. Add an entry here and bump the BannerId union.
 *   2. Extend lib/banners/eligibility.ts with its show/done logic.
 *   3. Optionally add a glow style in app/globals.css under .nx-banner.<kind>.
 */

import type { IconName } from '@/components/workspace/ui/nx'
import type { ModuleKind } from '@/components/workspace/ui/nx'

export const BANNER_IDS = [
  /**
   * NOTE: order here also dictates default visual order if priorities tie.
   * Priority numbers in `eligibility.ts` are the authoritative sort.
   */
  'critical-setup', // Phase-D placeholder slot for any blocking setup banner.
  'seerbit',        // Payment activation
  'inventory',      // First-product / missing-stock onboarding
  'insights',       // Nudge to open Reports once meaningful sales exist
  'social',         // WhatsApp / Instagram social-commerce nudge
  'upgrade',        // Plan upgrade (after engagement threshold)
] as const

export type BannerId = (typeof BANNER_IDS)[number]

export interface BannerDef {
  id: BannerId
  /** CSS modifier on .nx-banner (drives the glow color). */
  kind: BannerId
  icon: IconName
  title: string
  sub: string
  cta: string
  /** Destination key — page-level handler decides routing. Null = no route. */
  go: string | null
  /** "Done" status-card mapping (compact recap shown once a goal is met). */
  done?: {
    icon: IconName
    mod: ModuleKind
    /** Either a static string or a function of business state. */
    title: string | ((s: BannerBusinessState) => string)
    cta: string
    go: string
  }
}

/**
 * Live business state used by both eligibility AND the `done` status cards.
 * Fields are all optional with safe defaults so the dashboard never breaks
 * if a counter source isn't wired yet (early phases).
 */
export interface BannerBusinessState {
  seerbitStatus?: SeerbitStatus
  webhookVerified?: boolean
  settlementAdded?: boolean
  successfulLivePayments?: number
  productCount?: number
  missingStockCount?: number
  lowStockCount?: number
  salesCount?: number
  reportsOpened?: boolean
  socialOrdersCount?: number
  planUsage?: number
}

export type SeerbitStatus =
  | 'not-connected'
  | 'test'
  | 'pending-kyc'
  | 'live'
  | 'error'

export const BANNER_DEFS: Record<BannerId, BannerDef> = {
  'critical-setup': {
    id: 'critical-setup',
    kind: 'critical-setup',
    icon: 'triangle-alert',
    title: 'Finish required setup',
    sub: 'A few steps remain before sales can be recorded reliably.',
    cta: 'Resume setup',
    go: 'settings',
  },
  seerbit: {
    id: 'seerbit',
    kind: 'seerbit',
    icon: 'shield-check',
    title: 'Accept payments faster with NEXPOS Pay',
    sub: 'Activate SeerBit payments and collect card, mobile money, and online checkout payments.',
    cta: 'Set up payments',
    go: 'payments',
    done: {
      icon: 'badge-check',
      mod: 'pos',
      title: 'SeerBit Live · Payments active',
      cta: 'View payments',
      go: 'payments',
    },
  },
  inventory: {
    id: 'inventory',
    kind: 'inventory',
    icon: 'scan-barcode',
    title: 'Never lose track of stock again',
    sub: 'Add products, monitor low stock, and see what moves fastest.',
    cta: 'Add products',
    go: 'products',
    done: {
      icon: 'boxes',
      mod: 'inventory',
      title: (s) =>
        `${s.productCount ?? 0} products tracked · ${s.lowStockCount ?? 0} low stock`,
      cta: 'Review stock',
      go: 'inventory',
    },
  },
  insights: {
    id: 'insights',
    kind: 'insights',
    icon: 'line-chart',
    title: 'Know your business pulse',
    sub: 'Track daily sales, profit, and payment trends without spreadsheets.',
    cta: 'View insights',
    go: 'reports',
  },
  social: {
    id: 'social',
    kind: 'social',
    icon: 'message-circle',
    title: 'Turn DM orders into real sales',
    sub: 'Manage WhatsApp and Instagram orders, customers, payments, and delivery records.',
    cta: 'Start selling',
    go: null,
  },
  upgrade: {
    id: 'upgrade',
    kind: 'upgrade',
    icon: 'crown',
    title: 'Unlock smarter operations',
    sub: 'Advanced reports, staff controls, payment automation, and multi-branch tools.',
    cta: 'Explore plans',
    go: null,
  },
}
