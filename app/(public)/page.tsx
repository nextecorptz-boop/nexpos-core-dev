import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Terminal, ShieldCheck, Zap, Globe, BarChart3, CreditCard, Smartphone, ChevronRight, Check, X, ArrowUpRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'NEXPOS — Enterprise Retail Operating System for Tanzania',
  description: 'Multi-branch POS, real-time inventory, credit registry, and M-Pesa reconciliation built for Tanzanian retail businesses. Start your free trial today.',
}

const NAV_LINKS = [
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
  { href: '/catalog/nexpos', label: 'Catalog' },
]

const CAPABILITIES = [
  {
    id: 'inventory',
    icon: BarChart3,
    label: 'Multi-Branch Inventory',
    headline: 'Real-Time Movement-Based Inventory Tracking',
    description:
      'Track stock across unlimited branches using event-driven movement logs. Every sale, purchase, transfer, and adjustment is recorded as an immutable ledger entry — giving you a complete forensic audit trail of every unit.',
    features: [
      'Branch-level stock segregation & RLS isolation',
      'Atomic inventory transfer dispatch & receive workflows',
      'Low stock threshold alerts per branch',
      'Movement history with full actor & device traceability',
    ],
  },
  {
    id: 'pos',
    icon: Smartphone,
    label: 'POS Checkout',
    headline: 'High-Performance Touch POS Checkout Canvas',
    description:
      'Offline-first checkout terminal built for tablet hardware. Processes sales, payments, and receipts with sub-100ms local response — even with zero network connectivity. Syncs atomically when connection resumes.',
    features: [
      'Offline-first with IndexedDB tiered mutation queues',
      'Multi-payment method support (Cash, M-Pesa, Card)',
      'Real-time barcode scanning & smart search',
      'Tax calculation, discounts, and receipt generation',
    ],
  },
  {
    id: 'credit',
    icon: CreditCard,
    label: 'Credit Registry',
    headline: 'Comprehensive Credit Registry & Automation',
    description:
      'Full credit lifecycle management from issuance to recovery. Automate payment reminders, track outstanding balances, and generate aging reports per customer with full repayment audit logs.',
    features: [
      'Customer-level credit accounts & balance tracking',
      'Installment schedules & payment recording',
      'Overdue aging reports (30/60/90+ days)',
      'Credit limit enforcement at checkout',
    ],
  },
  {
    id: 'payments',
    icon: Zap,
    label: 'Payment Reconciliation',
    headline: 'Automated Local Payment Reconciliation',
    description:
      'Reconcile M-Pesa, Tigo Pesa, and other mobile money payments automatically. Match incoming transaction references against open sale records and surface discrepancies without manual intervention.',
    features: [
      'M-Pesa & Tigo Pesa transaction matching',
      'Till session open/close cash variance detection',
      'Daily reconciliation summary reports',
      'Payment gateway reference auditing',
    ],
  },
]

const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '46,000',
    period: '/month',
    currency: 'TZS',
    badge: null,
    description: 'Single-terminal operations for small retail shops.',
    limits: ['1 POS Terminal', '2 Branches max', '5 Staff accounts', '500 Product catalog'],
    features: [
      'Offline-first POS checkout',
      'Daily sales reports',
      'Basic inventory tracking',
      'Cash payment management',
      'Customer credit accounts',
    ],
    excludes: ['Priority engineering support', 'Multi-terminal sync', 'QuickBooks integration'],
    cta: 'Start Free Trial',
    ctaHref: '/signup',
    highlighted: false,
  },
  {
    id: 'business',
    name: 'Business',
    price: '97,000',
    period: '/month',
    currency: 'TZS',
    badge: 'MOST POPULAR',
    description: 'Full lifecycle inventory & multi-terminal operations.',
    limits: ['5 POS Terminals', 'Unlimited branches', 'Unlimited staff', 'Unlimited products'],
    features: [
      'Everything in Starter',
      'Multi-terminal sync engine',
      'Inventory lifecycle automation',
      'M-Pesa reconciliation',
      'Priority engineering support',
      'Transfer workflows',
      'Advanced reporting suite',
    ],
    excludes: ['QuickBooks/Xero integration', 'Staff accounting workflows'],
    cta: 'Start Free Trial',
    ctaHref: '/signup',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Growth Enterprise',
    price: '184,000',
    period: '/month',
    currency: 'TZS',
    badge: 'ENTERPRISE',
    description: 'Multi-branch cluster with full accounting integrations.',
    limits: ['Unlimited terminals', 'Multi-branch cluster', 'Unlimited staff', 'Unlimited products'],
    features: [
      'Everything in Business',
      'Multi-branch cluster networking',
      'Staff accounting workflows',
      'QuickBooks / Xero sync',
      'Custom database integrations',
      'Dedicated engineering support',
      'SLA uptime guarantee',
      'Audit compliance exports',
    ],
    excludes: [],
    cta: 'Contact Sales',
    ctaHref: '/contact',
    highlighted: false,
  },
]

const STATS = [
  { value: '< 100ms', label: 'Offline checkout response' },
  { value: '99.9%', label: 'Multi-tenant uptime SLA' },
  { value: '576k+', label: 'Events/sec ledger throughput' },
  { value: 'TZS', label: 'Native currency engine' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0E0D0B] text-[#FAF6EE] overflow-x-hidden">

      {/* ── NAVIGATION ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0E0D0B]/90 backdrop-blur-sm border-b border-[#1E1B17]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#00C9E4] flex items-center justify-center">
                <Terminal className="w-4 h-4 text-[#0E0D0B]" />
              </div>
              <span className="font-display font-bold text-lg tracking-tight text-[#FAF6EE]">
                NEX<span className="text-[#00C9E4]">POS</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A19B94] hover:text-[#FAF6EE] transition-colors duration-150"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden sm:inline-flex text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A19B94] hover:text-[#FAF6EE] transition-colors duration-150 px-3 py-2"
              >
                Staff Login
              </Link>
              <Link
                href="/signup"
                id="nav-signup-cta"
                className="inline-flex items-center gap-1.5 bg-[#00C9E4] text-[#0E0D0B] text-[11px] font-bold uppercase tracking-[0.12em] px-4 py-2.5 hover:bg-[#00C9E4]/90 transition-all duration-150"
              >
                Free Trial
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-32 pb-24 lg:pt-44 lg:pb-36 relative">
        {/* Grid background pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#00C9E4 1px, transparent 1px), linear-gradient(90deg, #00C9E4 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Cyan glow */}
        <div className="absolute top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#00C9E4]/5 blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 lg:px-10 relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 border border-[#292521] bg-[#161412] px-3 py-1.5 mb-10">
            <div className="w-1.5 h-1.5 bg-[#00C9E4] animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#00C9E4]">
              Enterprise Retail OS — Built for Tanzania
            </span>
          </div>

          <div className="max-w-5xl">
            <h1 className="font-display text-5xl sm:text-6xl lg:text-8xl font-bold leading-[0.92] tracking-tight text-[#FAF6EE] mb-8">
              The Operating System
              <br />
              for{' '}
              <span className="text-[#00C9E4]">Modern Retail</span>
              <br />
              <span className="text-[#3A3530]">—</span>
            </h1>

            <p className="text-[#A19B94] text-lg lg:text-xl max-w-2xl leading-relaxed mb-12 font-body">
              Multi-branch inventory, offline-first POS, automated M-Pesa reconciliation,
              and enterprise credit registry — unified into one platform built specifically
              for Tanzanian retail operations.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                id="hero-signup-cta"
                className="inline-flex items-center justify-center gap-2 bg-[#00C9E4] text-[#0E0D0B] font-bold uppercase tracking-[0.1em] text-sm px-8 py-4 hover:bg-[#00C9E4]/90 transition-all duration-200 active:scale-[0.98]"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/catalog/nexpos"
                id="hero-catalog-cta"
                className="inline-flex items-center justify-center gap-2 border border-[#292521] bg-transparent text-[#FAF6EE] font-semibold uppercase tracking-[0.1em] text-sm px-8 py-4 hover:border-[#41362D] hover:bg-[#161412] transition-all duration-200"
              >
                View Live Catalog
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-[#1E1B17] bg-[#0C0B09]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-[#1E1B17]">
            {STATS.map((stat) => (
              <div key={stat.label} className="px-8 py-8 text-center">
                <div className="font-data text-2xl lg:text-3xl font-bold text-[#00C9E4] mb-1">
                  {stat.value}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#5A534C]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CAPABILITIES ── */}
      <section id="capabilities" className="py-24 lg:py-36 border-b border-[#1E1B17]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          {/* Section header */}
          <div className="mb-20">
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-6 h-px bg-[#00C9E4]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00C9E4]">
                Platform Capabilities
              </span>
            </div>
            <h2 className="font-display text-4xl lg:text-6xl font-bold text-[#FAF6EE] leading-tight max-w-2xl">
              Infrastructure-Grade
              <br />
              <span className="text-[#3A3530]">Retail Primitives</span>
            </h2>
          </div>

          {/* Capability panels */}
          <div className="space-y-0 border border-[#1E1B17]">
            {CAPABILITIES.map((cap, idx) => {
              const Icon = cap.icon
              return (
                <div
                  key={cap.id}
                  id={`capability-${cap.id}`}
                  className="grid lg:grid-cols-2 border-b border-[#1E1B17] last:border-b-0 group"
                >
                  {/* Left: content */}
                  <div className={`p-10 lg:p-14 ${idx % 2 === 1 ? 'lg:order-2' : ''}`}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 border border-[#00C9E4]/30 flex items-center justify-center group-hover:border-[#00C9E4] group-hover:bg-[#00C9E4]/5 transition-all duration-200">
                        <Icon className="w-4 h-4 text-[#00C9E4]" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] group-hover:text-[#00C9E4] transition-colors">
                        {cap.label}
                      </span>
                    </div>

                    <h3 className="font-display text-2xl lg:text-3xl font-bold text-[#FAF6EE] mb-4 leading-tight">
                      {cap.headline}
                    </h3>
                    <p className="text-[#A19B94] leading-relaxed text-[15px] mb-8">
                      {cap.description}
                    </p>

                    <ul className="space-y-3">
                      {cap.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-3 text-sm text-[#A19B94]">
                          <div className="w-1 h-1 bg-[#00C9E4] mt-2 shrink-0" />
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Right: decorative data panel */}
                  <div
                    className={`bg-[#0A0908] border-l border-[#1E1B17] p-10 lg:p-14 flex flex-col justify-center ${idx % 2 === 1 ? 'lg:order-1 border-l-0 border-r border-[#1E1B17]' : ''}`}
                  >
                    <div className="font-data text-[10px] text-[#3A3530] mb-6 uppercase tracking-widest">
                      // {cap.id}.service — status: ACTIVE
                    </div>
                    <div className="space-y-3">
                      {cap.features.map((feat, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between border border-[#1E1B17] px-4 py-2.5 group-hover:border-[#292521] transition-colors"
                        >
                          <span className="font-data text-[11px] text-[#5A534C]">
                            [{String(i + 1).padStart(2, '0')}]
                          </span>
                          <span className="font-data text-[11px] text-[#A19B94] truncate mx-3 text-right">
                            {feat}
                          </span>
                          <span className="font-data text-[10px] text-[#00C9E4] shrink-0">OK</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 lg:py-36 border-b border-[#1E1B17]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          {/* Header */}
          <div className="mb-20 lg:flex lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 mb-6">
                <div className="w-6 h-px bg-[#C9A84C]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A84C]">
                  Subscription Tiers — TZS
                </span>
              </div>
              <h2 className="font-display text-4xl lg:text-6xl font-bold text-[#FAF6EE] leading-tight">
                Transparent
                <br />
                <span className="text-[#3A3530]">Pricing Matrix</span>
              </h2>
            </div>
            <p className="text-[#A19B94] text-sm max-w-xs mt-6 lg:mt-0 leading-relaxed">
              All plans include 14-day free trial.
              <br />
              No credit card required to start.
            </p>
          </div>

          {/* Pricing grid */}
          <div className="grid lg:grid-cols-3 gap-0 border border-[#1E1B17]">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.id}
                id={`pricing-${tier.id}`}
                className={`relative flex flex-col border-r border-[#1E1B17] last:border-r-0 ${
                  tier.highlighted
                    ? 'bg-[#0D1214] ring-1 ring-inset ring-[#00C9E4]/20'
                    : 'bg-[#0A0908]'
                }`}
              >
                {/* Badge */}
                {tier.badge && (
                  <div
                    className={`absolute top-0 inset-x-0 flex justify-center -translate-y-px`}
                  >
                    <div
                      className={`text-[9px] font-bold uppercase tracking-[0.2em] px-4 py-1 ${
                        tier.id === 'enterprise'
                          ? 'bg-[#C9A84C] text-[#0E0D0B]'
                          : 'bg-[#00C9E4] text-[#0E0D0B]'
                      }`}
                    >
                      {tier.badge}
                    </div>
                  </div>
                )}

                <div className="p-8 lg:p-10 flex flex-col flex-1">
                  {/* Tier header */}
                  <div className="border-b border-[#1E1B17] pb-8 mb-8">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-3">
                      {tier.name}
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="font-data text-[11px] text-[#5A534C] mt-1">TZS</span>
                      <span className="font-data text-4xl lg:text-5xl font-bold text-[#FAF6EE]">
                        {tier.price}
                      </span>
                      <span className="text-[11px] text-[#5A534C]">/mo</span>
                    </div>
                    <p className="text-[13px] text-[#A19B94] leading-snug">{tier.description}</p>
                  </div>

                  {/* Limits */}
                  <div className="mb-8">
                    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-4">
                      System Limits
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {tier.limits.map((limit) => (
                        <div
                          key={limit}
                          className="border border-[#1E1B17] px-3 py-2 text-center"
                        >
                          <span className="font-data text-[10px] text-[#A19B94]">{limit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Features included */}
                  <div className="mb-6 flex-1">
                    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#5A534C] mb-4">
                      Included
                    </div>
                    <ul className="space-y-2.5">
                      {tier.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5 text-[12px] text-[#A19B94]">
                          <Check className="w-3.5 h-3.5 text-[#00C9E4] mt-0.5 shrink-0" />
                          {feat}
                        </li>
                      ))}
                      {tier.excludes.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5 text-[12px] text-[#3A3530]">
                          <X className="w-3.5 h-3.5 text-[#3A3530] mt-0.5 shrink-0" />
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <Link
                    href={tier.ctaHref}
                    id={`pricing-cta-${tier.id}`}
                    className={`w-full flex items-center justify-center gap-2 font-bold uppercase tracking-[0.1em] text-[11px] px-6 py-3.5 transition-all duration-200 mt-auto ${
                      tier.highlighted
                        ? 'bg-[#00C9E4] text-[#0E0D0B] hover:bg-[#00C9E4]/90'
                        : tier.id === 'enterprise'
                        ? 'bg-[#C9A84C] text-[#0E0D0B] hover:bg-[#C9A84C]/90'
                        : 'border border-[#292521] text-[#FAF6EE] hover:bg-[#161412] hover:border-[#41362D]'
                    }`}
                  >
                    {tier.cta}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Footnote */}
          <p className="text-[11px] text-[#3A3530] mt-6 text-center font-data">
            * Database-level caps enforced via Supabase RLS triggers. Plan limits are hard-coded at the infrastructure layer.
          </p>
        </div>
      </section>

      {/* ── SECURITY ARCHITECTURE CALLOUT ── */}
      <section className="py-24 lg:py-36 border-b border-[#1E1B17]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-0 border border-[#1E1B17]">
            <div className="p-12 lg:p-16 border-r border-[#1E1B17]">
              <div className="inline-flex items-center gap-2 mb-8">
                <div className="w-6 h-px bg-[#00C9E4]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00C9E4]">
                  Security Architecture
                </span>
              </div>
              <h2 className="font-display text-3xl lg:text-4xl font-bold text-[#FAF6EE] mb-6 leading-tight">
                Financial-Grade
                <br />
                Data Protection
              </h2>
              <p className="text-[#A19B94] leading-relaxed text-[15px] mb-10">
                NEXPOS enforces multi-tenant Row-Level Security at the PostgreSQL layer, 
                SHA-256 cryptographic event signature chains, append-only ledger triggers 
                that physically block database tampering, and RBAC across every API surface.
              </p>
              <div className="space-y-3">
                {[
                  'Multi-tenant RLS isolation (Supabase PostgreSQL)',
                  'Append-only event ledger with tamper-evidence chain',
                  'SHA-256 signature verification per event row',
                  'Device isolation after 14-day sync staleness',
                  'Role-based access: Owner / Manager / Cashier',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-[#A19B94]">
                    <ShieldCheck className="w-4 h-4 text-[#00C9E4] mt-0.5 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0A0908] p-12 lg:p-16 flex flex-col justify-between">
              <div>
                <div className="font-data text-[10px] text-[#3A3530] mb-6 uppercase tracking-widest">
                  // security.audit.log — realtime
                </div>
                {[
                  { time: '09:41:02', event: 'RLS_POLICY_ENFORCED', level: 'INFO' },
                  { time: '09:41:03', event: 'EVENT_CHAIN_VERIFIED', level: 'INFO' },
                  { time: '09:41:05', event: 'TENANT_ISOLATION_OK', level: 'INFO' },
                  { time: '09:41:07', event: 'DEVICE_STALENESS_CHECK', level: 'WARN' },
                  { time: '09:41:09', event: 'TAMPER_GUARD_ACTIVE', level: 'INFO' },
                  { time: '09:41:10', event: 'APPEND_ONLY_ENFORCED', level: 'INFO' },
                ].map((log) => (
                  <div key={log.event} className="flex items-center gap-4 py-2.5 border-b border-[#1E1B17] last:border-b-0">
                    <span className="font-data text-[10px] text-[#3A3530] w-16 shrink-0">{log.time}</span>
                    <span
                      className={`font-data text-[10px] w-12 shrink-0 ${
                        log.level === 'WARN' ? 'text-[#C9A84C]' : 'text-[#00C9E4]'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="font-data text-[11px] text-[#A19B94]">{log.event}</span>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 border border-[#292521] text-[#FAF6EE] font-bold uppercase tracking-[0.1em] text-[11px] px-6 py-3.5 hover:bg-[#161412] hover:border-[#41362D] transition-all duration-200"
                >
                  Deploy Secure Instance
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT CTA STRIP ── */}
      <section className="py-20 lg:py-28 border-b border-[#1E1B17]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
            <div>
              <div className="inline-flex items-center gap-2 mb-5">
                <div className="w-6 h-px bg-[#C9A84C]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A84C]">
                  Enterprise Sales
                </span>
              </div>
              <h2 className="font-display text-3xl lg:text-5xl font-bold text-[#FAF6EE] leading-tight">
                Scale Beyond
                <br />
                Standard Plans
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/contact"
                id="contact-enterprise-cta"
                className="inline-flex items-center justify-center gap-2 bg-[#C9A84C] text-[#0E0D0B] font-bold uppercase tracking-[0.1em] text-sm px-8 py-4 hover:bg-[#C9A84C]/90 transition-all duration-200"
              >
                Contact Enterprise Sales
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 border border-[#292521] text-[#FAF6EE] font-semibold uppercase tracking-[0.1em] text-sm px-8 py-4 hover:bg-[#161412] transition-all duration-200"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-14 bg-[#0A0908]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-7 h-7 bg-[#00C9E4] flex items-center justify-center">
                  <Terminal className="w-3.5 h-3.5 text-[#0E0D0B]" />
                </div>
                <span className="font-display font-bold text-[#FAF6EE]">
                  NEX<span className="text-[#00C9E4]">POS</span>
                </span>
              </div>
              <p className="text-[#5A534C] text-sm leading-relaxed max-w-xs">
                Enterprise retail operating system built for multi-branch Tanzanian businesses.
                Offline-first, event-sourced, and financially auditable.
              </p>
            </div>

            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#3A3530] mb-5">
                Platform
              </div>
              <ul className="space-y-3">
                {[
                  { href: '#capabilities', label: 'Capabilities' },
                  { href: '#pricing', label: 'Pricing' },
                  { href: '/catalog/nexpos', label: 'Live Catalog' },
                  { href: '/signup', label: 'Free Trial' },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[12px] text-[#5A534C] hover:text-[#A19B94] transition-colors tracking-wide"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#3A3530] mb-5">
                Company
              </div>
              <ul className="space-y-3">
                {[
                  { href: '/contact', label: 'Contact Sales' },
                  { href: '/login', label: 'Staff Portal' },
                  { href: '/signup', label: 'Get Started' },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[12px] text-[#5A534C] hover:text-[#A19B94] transition-colors tracking-wide"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-[#1E1B17] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-data text-[10px] text-[#3A3530] uppercase tracking-widest">
              © 2025 NEXPOS / Nextec Corp — All rights reserved
            </p>
            <div className="flex items-center gap-2">
              <Globe className="w-3 h-3 text-[#3A3530]" />
              <span className="font-data text-[10px] text-[#3A3530] uppercase tracking-widest">
                Tanzania · EAT (UTC+3)
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
