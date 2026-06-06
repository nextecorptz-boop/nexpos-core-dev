import { requireRole } from '@/lib/auth/session'
import { LockKeyhole, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

const MOCK_ENTRY_TYPES = [
  { label: 'Login Success', desc: 'Successful authentication event' },
  { label: 'Login Failed', desc: 'Failed authentication attempt' },
  { label: 'Role Change', desc: 'User role was modified' },
  { label: 'Till Open', desc: 'Till session was opened' },
  { label: 'Till Close', desc: 'Till session was closed and reconciled' },
  { label: 'Void Sale', desc: 'A completed sale was voided' },
  { label: 'Return Processed', desc: 'Refund was processed against a sale' },
  { label: 'Discount Applied', desc: 'Manual discount applied at POS' },
]

export default async function SecurityLogPage() {
  await requireRole(['owner', 'manager'])

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-nx-text-sec" />
            <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3]">
              Security Log
            </h1>
          </div>
          <p className="text-nx-text-sec text-[12px]">
            Audit trail for authentication events, role changes, and sensitive operations
          </p>
        </div>
      </div>

      {/* Activation notice */}
      <div className="flex items-start gap-3 bg-nx-surface border border-nx-border/50 rounded-nx-card px-5 py-4 mb-6 select-none">
        <LockKeyhole className="w-4 h-4 text-nx-text-muted flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-nx-text-muted leading-relaxed">
          The audit logging backend is not yet activated. When enabled, all security-relevant
          events will be persisted with actor identity, timestamp, IP, and event payload. The
          event types below represent the full audit coverage this module provides.
        </p>
      </div>

      {/* KPI placeholders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-6 select-none">
        {[
          { label: 'Events Today', value: '—' },
          { label: 'Failed Logins', value: '—' },
          { label: 'Voids / Overrides', value: '—' },
          { label: 'Role Changes', value: '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
            <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
              {label}
            </p>
            <p className="font-data text-[28px] font-bold text-nx-text-muted">{value}</p>
            <p className="text-[11px] text-nx-text-faint mt-1">Backend activation required</p>
          </div>
        ))}
      </div>

      {/* Event log empty state */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden mb-6">
        <div className="p-5 border-b border-nx-border select-none">
          <h3 className="font-ui text-[14px] font-semibold text-nx-text">Event Log</h3>
        </div>
        <div className="py-16 flex flex-col items-center gap-3 select-none">
          <ShieldCheck className="w-10 h-10 text-nx-text-faint" />
          <p className="font-ui text-[14px] font-semibold text-nx-text-sec">
            No audit events recorded
          </p>
          <p className="text-[12px] text-nx-text-muted text-center max-w-xs">
            Security events will appear here in real time once the audit logging backend is
            activated.
          </p>
        </div>
      </div>

      {/* Event coverage reference */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
        <h3 className="font-ui text-[13px] font-semibold text-nx-text mb-4 select-none">
          Audit Coverage — Event Types
        </h3>
        <div className="grid md:grid-cols-2 gap-2">
          {MOCK_ENTRY_TYPES.map(({ label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-3 px-4 py-3 bg-nx-elevated rounded-nx-xs border border-nx-border/50"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-nx-border-strong mt-1.5 flex-shrink-0" />
              <div>
                <p className="font-ui text-[12px] font-semibold text-nx-text-sec">{label}</p>
                <p className="text-[11px] text-nx-text-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
