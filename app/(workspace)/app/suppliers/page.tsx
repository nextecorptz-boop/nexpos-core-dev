import { requireRole } from '@/lib/auth/session'
import { AlertTriangle, Building2, LockKeyhole } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SuppliersPage() {
  await requireRole(['owner', 'manager'])

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-nx-text-sec" />
            <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3]">
              Suppliers
            </h1>
          </div>
          <p className="text-nx-text-sec text-[12px]">
            Supplier directory and procurement contacts
          </p>
        </div>
        <button
          disabled
          aria-disabled="true"
          title="Supplier registry backend activation required"
          className="flex items-center gap-2 bg-nx-elevated border border-nx-border text-nx-text-muted px-4 py-2 rounded-nx-btn text-[13px] font-medium cursor-not-allowed opacity-60 select-none"
        >
          <LockKeyhole className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      {/* Activation notice */}
      <div className="flex items-start gap-3 bg-nx-amber/5 border border-nx-amber/20 rounded-nx-card px-5 py-4 mb-6 select-none">
        <AlertTriangle className="w-5 h-5 text-nx-amber flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-ui text-[13px] font-semibold text-nx-amber mb-0.5">
            Supplier registry backend activation required
          </p>
          <p className="text-[12px] text-nx-text-muted leading-relaxed">
            The supplier registry module manages vendor contacts, payment terms, outstanding
            balances, and purchase history. Activate this module to begin onboarding suppliers.
          </p>
        </div>
      </div>

      {/* KPI placeholders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-6 select-none">
        {[
          { label: 'Active Suppliers', value: '—' },
          { label: 'Outstanding Balance', value: '—' },
          { label: 'Orders This Month', value: '—' },
          { label: 'Pending Invoices', value: '—' },
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

      {/* Directory empty state */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden mb-6">
        <div className="p-5 border-b border-nx-border select-none">
          <h3 className="font-ui text-[14px] font-semibold text-nx-text">Supplier Directory</h3>
        </div>
        <div className="py-20 flex flex-col items-center gap-3 select-none">
          <Building2 className="w-10 h-10 text-nx-text-faint" />
          <p className="font-ui text-[14px] font-semibold text-nx-text-sec">
            No suppliers registered
          </p>
          <p className="text-[12px] text-nx-text-muted text-center max-w-xs">
            Supplier accounts, contact details, and procurement terms will appear here once the
            Supplier Registry module is activated.
          </p>
        </div>
      </div>

      {/* Disabled add supplier form shell */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 opacity-50 pointer-events-none select-none">
        <h3 className="font-ui text-[13px] font-semibold text-nx-text mb-4">New Supplier</h3>
        <div className="grid md:grid-cols-3 gap-4 mb-5">
          {['Supplier Name', 'Phone / Email', 'Category'].map((label) => (
            <div key={label}>
              <label className="block text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
                {label}
              </label>
              <div className="w-full bg-nx-elevated border border-nx-border rounded-nx-btn px-3 py-2 h-9" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <div className="bg-nx-elevated border border-nx-border rounded-nx-btn px-5 py-2 text-[13px] text-nx-text-muted">
            Save Supplier
          </div>
        </div>
      </div>

      {/* Footer notice */}
      <div className="flex items-start gap-3 bg-nx-surface border border-nx-border/50 rounded-nx-card px-5 py-4 mt-6 select-none">
        <LockKeyhole className="w-4 h-4 text-nx-text-muted flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-nx-text-muted leading-relaxed">
          The Suppliers module enables vendor management, purchase order linking, payment terms
          tracking, and balance reconciliation. Contact your administrator to enable this module.
        </p>
      </div>
    </div>
  )
}
