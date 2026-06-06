import { requireRole } from '@/lib/auth/session'
import { AlertTriangle, LockKeyhole, Receipt } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  await requireRole(['owner', 'manager'])

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="w-5 h-5 text-nx-text-sec" />
            <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3]">
              Expenses
            </h1>
          </div>
          <p className="text-nx-text-sec text-[12px]">
            Operational expense tracking and category management
          </p>
        </div>
        <button
          disabled
          aria-disabled="true"
          title="Expense tracking backend activation required"
          className="flex items-center gap-2 bg-nx-elevated border border-nx-border text-nx-text-muted px-4 py-2 rounded-nx-btn text-[13px] font-medium cursor-not-allowed opacity-60 select-none"
        >
          <LockKeyhole className="w-4 h-4" />
          Record Expense
        </button>
      </div>

      {/* Activation notice */}
      <div className="flex items-start gap-3 bg-nx-amber/5 border border-nx-amber/20 rounded-nx-card px-5 py-4 mb-6 select-none">
        <AlertTriangle className="w-5 h-5 text-nx-amber flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-ui text-[13px] font-semibold text-nx-amber mb-0.5">
            Expense tracking backend activation required
          </p>
          <p className="text-[12px] text-nx-text-muted leading-relaxed">
            Categorized expenses, budget tracking, and integration with till reconciliation will
            be available once the Expense module is activated.
          </p>
        </div>
      </div>

      {/* KPI placeholders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-6 select-none">
        {[
          { label: 'This Month', value: '—' },
          { label: 'Last Month', value: '—' },
          { label: 'Categories', value: '—' },
          { label: 'Pending Approval', value: '—' },
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

      {/* Expense list empty state */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden mb-6">
        <div className="p-5 border-b border-nx-border select-none">
          <h3 className="font-ui text-[14px] font-semibold text-nx-text">Expense Log</h3>
        </div>
        <div className="py-16 flex flex-col items-center gap-3 select-none">
          <Receipt className="w-10 h-10 text-nx-text-faint" />
          <p className="font-ui text-[14px] font-semibold text-nx-text-sec">
            No expenses recorded
          </p>
          <p className="text-[12px] text-nx-text-muted text-center max-w-xs">
            Operational expenses — rent, utilities, wages, supplies — will be tracked and
            categorised here once the module is enabled.
          </p>
        </div>
      </div>

      {/* Disabled entry form shell */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 opacity-50 pointer-events-none select-none">
        <h3 className="font-ui text-[13px] font-semibold text-nx-text mb-4">Record Expense</h3>
        <div className="grid md:grid-cols-4 gap-4 mb-5">
          {['Category', 'Amount (TZS)', 'Date', 'Description'].map((label) => (
            <div key={label}>
              <label className="block text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
                {label}
              </label>
              <div className="w-full bg-nx-elevated border border-nx-border rounded-nx-btn px-3 py-2 h-9" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-4 border-t border-nx-border/50">
          <LockKeyhole className="w-4 h-4 text-nx-text-muted flex-shrink-0" />
          <p className="text-[12px] text-nx-text-muted">
            Expense recording requires backend module activation.
          </p>
          <div className="ml-auto bg-nx-elevated border border-nx-border rounded-nx-btn px-5 py-2 text-[13px] text-nx-text-muted">
            Save Expense
          </div>
        </div>
      </div>
    </div>
  )
}
