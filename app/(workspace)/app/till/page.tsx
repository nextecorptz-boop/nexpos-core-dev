import { requireRole } from '@/lib/auth/session'
import { AlertTriangle, LockKeyhole } from 'lucide-react'

export const dynamic = 'force-dynamic'

function TillRow({
  label,
  value,
  accent,
  last,
}: {
  label: string
  value?: string
  accent?: 'gold' | 'red' | 'green'
  last?: boolean
}) {
  const accentClass =
    accent === 'gold'
      ? 'text-nx-gold'
      : accent === 'red'
        ? 'text-nx-red'
        : accent === 'green'
          ? 'text-nx-green'
          : 'text-nx-text-sec'
  return (
    <div
      className={`flex items-center justify-between py-3 ${last ? '' : 'border-b border-nx-border/50'}`}
    >
      <span className="text-[13px] text-nx-text-sec">{label}</span>
      <span className={`font-data text-[13px] font-semibold ${accentClass}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

export default async function TillPage() {
  await requireRole(['owner', 'manager', 'cashier'])

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3] mb-1">Till</h1>
          <p className="text-nx-text-sec text-[12px]">
            Cash drawer reconciliation and shift summary
          </p>
        </div>
        <button
          disabled
          aria-disabled="true"
          title="Till session management requires backend activation"
          className="flex items-center gap-2 bg-nx-elevated border border-nx-border text-nx-text-muted px-4 py-2 rounded-nx-btn text-[13px] font-medium cursor-not-allowed opacity-60 select-none"
        >
          <LockKeyhole className="w-4 h-4" />
          Open Till Session
        </button>
      </div>

      {/* Activation notice */}
      <div className="flex items-start gap-3 bg-nx-amber/5 border border-nx-amber/20 rounded-nx-card px-5 py-4 mb-6 select-none">
        <AlertTriangle className="w-5 h-5 text-nx-amber flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-ui text-[13px] font-semibold text-nx-amber mb-0.5">
            Till session management requires backend activation
          </p>
          <p className="text-[12px] text-nx-text-muted leading-relaxed">
            Opening floats, shift tracking, and closing reconciliation will be fully operational
            once till sessions are enabled for your workspace. The structure below shows your
            expected session surface. No data is written until activation.
          </p>
        </div>
      </div>

      {/* Till section grid */}
      <div className="grid md:grid-cols-2 gap-[14px]">
        {/* Opening */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <h3 className="font-ui text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1">
            Opening
          </h3>
          <TillRow label="Opening Float (Cash)" />
          <TillRow label="Session Start Time" />
          <TillRow label="Opened By" last />
        </div>

        {/* Takings */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <h3 className="font-ui text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1">
            Takings
          </h3>
          <TillRow label="Cash Sales" />
          <TillRow label="Card / Mobile Sales" />
          <TillRow label="Credit Sales" />
          <TillRow label="Gross Takings" accent="gold" last />
        </div>

        {/* Outgoings */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <h3 className="font-ui text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1">
            Outgoings
          </h3>
          <TillRow label="Expenses Paid Out" />
          <TillRow label="Refunds Issued" last />
        </div>

        {/* Reconciliation */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <h3 className="font-ui text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1">
            Reconciliation
          </h3>
          <TillRow label="Expected Cash in Drawer" accent="gold" />
          <TillRow label="Actual Closing Cash" />
          <TillRow label="Variance" accent="red" last />
        </div>
      </div>

      {/* Close session (disabled) */}
      <div className="mt-6 flex justify-end">
        <button
          disabled
          aria-disabled="true"
          title="Till session management requires backend activation"
          className="bg-nx-elevated border border-nx-border text-nx-text-muted px-6 py-2.5 rounded-nx-btn text-[13px] font-medium cursor-not-allowed opacity-60 select-none"
        >
          Close Session &amp; Reconcile
        </button>
      </div>
    </div>
  )
}
