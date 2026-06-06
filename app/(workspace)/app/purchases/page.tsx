import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { AlertTriangle, LockKeyhole, ShoppingBag } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PurchasesPage() {
  await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // Fetch low-stock items as restock suggestions
  const { data: stockRaw } = await supabase
    .from('stock_levels')
    .select('variant_id, on_hand, reorder_point, product_variants(sku, product_families(name))')
    .limit(100)

  const lowStock = ((stockRaw ?? []) as any[]).filter(
    (item) => Number(item.on_hand) <= Number(item.reorder_point ?? 0)
  )

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-5 h-5 text-nx-text-sec" />
            <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3]">
              Purchases
            </h1>
          </div>
          <p className="text-nx-text-sec text-[12px]">
            Purchase orders, supplier restocking, and stock receiving
          </p>
        </div>
        <button
          disabled
          aria-disabled="true"
          title="Purchase orders backend activation required"
          className="flex items-center gap-2 bg-nx-elevated border border-nx-border text-nx-text-muted px-4 py-2 rounded-nx-btn text-[13px] font-medium cursor-not-allowed opacity-60 select-none"
        >
          <LockKeyhole className="w-4 h-4" />
          Create Purchase Order
        </button>
      </div>

      {/* Activation notice */}
      <div className="flex items-start gap-3 bg-nx-amber/5 border border-nx-amber/20 rounded-nx-card px-5 py-4 mb-6 select-none">
        <AlertTriangle className="w-5 h-5 text-nx-amber flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-ui text-[13px] font-semibold text-nx-amber mb-0.5">
            Purchase orders backend activation required
          </p>
          <p className="text-[12px] text-nx-text-muted leading-relaxed">
            Draft and submitted purchase orders, receiving checklists, and supplier billing will be
            fully operational once the Purchases module is activated.
          </p>
        </div>
      </div>

      {/* KPI placeholders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-6 select-none">
        {[
          { label: 'Draft POs', value: '—' },
          { label: 'Pending Receiving', value: '—' },
          { label: 'Received This Month', value: '—' },
          { label: 'Supplier Balance', value: '—' },
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

      {/* Restock suggestions — real data from stock_levels */}
      {lowStock.length > 0 && (
        <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden mb-6">
          <div className="p-5 border-b border-nx-border flex items-center gap-2 select-none">
            <AlertTriangle className="w-4 h-4 text-nx-red" />
            <h3 className="font-ui text-[14px] font-semibold text-nx-text">
              Restock Suggestions
            </h3>
            <span className="ml-auto font-data text-[12px] text-nx-text-muted">
              {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} at or below reorder point
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[520px]">
              <thead>
                <tr className="bg-nx-elevated/50">
                  {['Product', 'SKU', 'On Hand', 'Reorder Point', 'Shortfall'].map((h) => (
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
                {lowStock.map((item: any, i: number) => {
                  const variant = item.product_variants as any
                  const family = variant?.product_families
                  const shortfall = Number(item.reorder_point ?? 0) - Number(item.on_hand)
                  return (
                    <tr
                      key={i}
                      className="border-b border-nx-border/50 last:border-0 hover:bg-nx-elevated transition-colors"
                    >
                      <td className="py-3 px-5 font-ui text-[13px] text-nx-text">
                        {family?.name ?? variant?.sku ?? item.variant_id}
                      </td>
                      <td className="py-3 px-5 font-data text-[11px] text-nx-text-muted">
                        {variant?.sku ?? '—'}
                      </td>
                      <td className="py-3 px-5 font-data text-[13px] font-bold text-nx-red">
                        {item.on_hand}
                      </td>
                      <td className="py-3 px-5 font-data text-[13px] text-nx-text-sec">
                        {item.reorder_point ?? 0}
                      </td>
                      <td className="py-3 px-5 font-data text-[12px] text-nx-amber">
                        {shortfall > 0 ? `+${shortfall} needed` : 'At threshold'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PO empty state */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden mb-6">
        <div className="p-5 border-b border-nx-border select-none">
          <h3 className="font-ui text-[14px] font-semibold text-nx-text">Purchase Orders</h3>
        </div>
        <div className="py-16 flex flex-col items-center gap-3 select-none">
          <ShoppingBag className="w-10 h-10 text-nx-text-faint" />
          <p className="font-ui text-[14px] font-semibold text-nx-text-sec">
            No purchase orders recorded
          </p>
          <p className="text-[12px] text-nx-text-muted text-center max-w-xs">
            Purchase orders created after module activation will appear here with full receiving
            and supplier reconciliation workflows.
          </p>
        </div>
      </div>

      {/* Disabled PO builder shell */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 opacity-50 pointer-events-none select-none">
        <h3 className="font-ui text-[13px] font-semibold text-nx-text mb-4">
          Purchase Order Builder
        </h3>
        <div className="grid md:grid-cols-3 gap-4 mb-5">
          {['Supplier', 'Expected Delivery', 'Reference / PO Number'].map((label) => (
            <div key={label}>
              <label className="block text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
                {label}
              </label>
              <div className="w-full bg-nx-elevated border border-nx-border rounded-nx-btn px-3 py-2 h-9" />
            </div>
          ))}
        </div>
        <div className="bg-nx-elevated border border-nx-border rounded-nx-card p-4 mb-5">
          <p className="text-[12px] text-nx-text-muted">
            Line items will be added here once the Purchase Orders module is activated.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-4 border-t border-nx-border/50">
          <LockKeyhole className="w-4 h-4 text-nx-text-muted flex-shrink-0" />
          <p className="text-[12px] text-nx-text-muted">
            Purchase order submission requires backend module activation.
          </p>
          <div className="ml-auto bg-nx-elevated border border-nx-border rounded-nx-btn px-5 py-2 text-[13px] text-nx-text-muted">
            Submit PO
          </div>
        </div>
      </div>
    </div>
  )
}
