import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { AlertTriangle, ArrowLeftRight, LockKeyhole } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmt(val: number): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(val)
}

export default async function TransfersPage() {
  await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // stock_movements is the closest existing table — show recent inventory movements
  const { data: raw } = await supabase
    .from('stock_movements')
    .select(
      'id, delta, reason, note, created_at, branch_id, variant_id, reference_type, reference_id, branches(name)'
    )
    .order('created_at', { ascending: false })
    .limit(50)

  const movements = (raw ?? []) as any[]

  // Collect variant IDs for name lookup
  const variantIds = [...new Set(movements.map((m) => m.variant_id as string).filter(Boolean))]
  const variantMap: Record<string, string> = {}
  if (variantIds.length > 0) {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, sku, product_families(name)')
      .in('id', variantIds)
    for (const v of variants ?? []) {
      const name = (v as any).product_families?.name ?? v.sku ?? v.id
      variantMap[v.id] = name
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="w-5 h-5 text-nx-text-sec" />
            <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3]">
              Transfers
            </h1>
          </div>
          <p className="text-nx-text-sec text-[12px]">
            Inventory movement between branches and locations
          </p>
        </div>
        <button
          disabled
          aria-disabled="true"
          title="Transfer backend activation required"
          className="flex items-center gap-2 bg-nx-elevated border border-nx-border text-nx-text-muted px-4 py-2 rounded-nx-btn text-[13px] font-medium cursor-not-allowed opacity-60 select-none"
        >
          <LockKeyhole className="w-4 h-4" />
          New Transfer
        </button>
      </div>

      {/* Activation notice */}
      <div className="flex items-start gap-3 bg-nx-amber/5 border border-nx-amber/20 rounded-nx-card px-5 py-4 mb-6 select-none">
        <AlertTriangle className="w-5 h-5 text-nx-amber flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-ui text-[13px] font-semibold text-nx-amber mb-0.5">
            Transfer backend activation required
          </p>
          <p className="text-[12px] text-nx-text-muted leading-relaxed">
            Branch-to-branch inventory transfers require the Transfers module to be enabled. The
            activity log below reflects all existing inventory movements from the stock ledger.
          </p>
        </div>
      </div>

      {/* KPI placeholders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-6 select-none">
        {[
          { label: 'Pending Transfers', value: '—' },
          { label: 'In Transit', value: '—' },
          { label: 'Completed Today', value: '—' },
          { label: 'Variance Alerts', value: '—' },
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

      {/* Stock movement log */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden mb-6">
        <div className="p-5 border-b border-nx-border flex items-center gap-2 select-none">
          <ArrowLeftRight className="w-4 h-4 text-nx-text-sec" />
          <h3 className="font-ui text-[14px] font-semibold text-nx-text">
            Inventory Movement Log
          </h3>
          <span className="ml-auto font-data text-[12px] text-nx-text-muted">
            {movements.length} record{movements.length !== 1 ? 's' : ''}
          </span>
        </div>

        {movements.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 select-none">
            <ArrowLeftRight className="w-10 h-10 text-nx-text-faint" />
            <p className="font-ui text-[14px] font-semibold text-nx-text-sec">
              No inventory movements recorded
            </p>
            <p className="text-[12px] text-nx-text-muted text-center max-w-xs">
              Stock movements are logged automatically when sales are processed or inventory is
              adjusted.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-nx-elevated/50">
                  {['Date', 'Product', 'Branch', 'Reason', 'Delta', 'Note'].map((h) => (
                    <th
                      key={h}
                      className="py-2.5 px-5 font-ui text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const delta = Number(m.delta)
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-nx-border/50 last:border-0 hover:bg-nx-elevated transition-colors"
                    >
                      <td className="py-3 px-5 font-data text-[12px] text-nx-text-sec whitespace-nowrap">
                        {new Date(m.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-5 font-ui text-[13px] text-nx-text">
                        {variantMap[m.variant_id] ?? m.variant_id ?? '—'}
                      </td>
                      <td className="py-3 px-5 font-ui text-[12px] text-nx-text-sec">
                        {(m.branches as any)?.name ?? m.branch_id ?? '—'}
                      </td>
                      <td className="py-3 px-5 font-data text-[11px] text-nx-text-muted capitalize">
                        {m.reason?.replace(/_/g, ' ') ?? '—'}
                      </td>
                      <td className="py-3 px-5">
                        <span
                          className={`font-data text-[13px] font-bold ${delta > 0 ? 'text-nx-green' : 'text-nx-red'}`}
                        >
                          {delta > 0 ? '+' : ''}{delta}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-[12px] text-nx-text-muted">
                        {m.note ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disabled transfer form shell */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 opacity-50 pointer-events-none select-none">
        <h3 className="font-ui text-[13px] font-semibold text-nx-text mb-4">
          Transfer Request
        </h3>
        <div className="grid md:grid-cols-4 gap-4">
          {['Source Branch', 'Destination Branch', 'Item', 'Quantity'].map((label) => (
            <div key={label}>
              <label className="block text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
                {label}
              </label>
              <div className="w-full bg-nx-elevated border border-nx-border rounded-nx-btn px-3 py-2 text-[13px] text-nx-text-muted h-9" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <div className="bg-nx-elevated border border-nx-border rounded-nx-btn px-5 py-2 text-[13px] text-nx-text-muted">
            Submit Transfer
          </div>
        </div>
      </div>
    </div>
  )
}
