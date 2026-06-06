import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { RotateCcw, Search, LockKeyhole, Receipt } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ receipt?: string }> }

function fmt(val: number): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(val)
}

export default async function ReturnsPage({ searchParams }: Props) {
  await requireRole(['owner', 'manager'])
  const { receipt } = await searchParams

  const supabase = await createClient()

  let sale: any = null
  let notFound = false

  if (receipt?.trim()) {
    const { data } = await supabase
      .from('sales')
      .select(
        `id, receipt_number, completed_at, total, subtotal, vat_amount,
         discount_amount, status, payment_method,
         customer:customers(full_name, phone),
         sale_lines(
           id, quantity, unit_price, line_total,
           product_variants(sku, size, color, product_families(name, brand))
         )`
      )
      .eq('receipt_number', receipt.trim())
      .eq('status', 'completed')
      .maybeSingle()

    sale = data
    notFound = !data
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Returns
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Look up a completed transaction to initiate a return
          </p>
        </div>
      </div>

      {/* Receipt lookup form */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 mb-6">
        <h3 className="font-ui text-[13px] font-semibold text-nx-text mb-4">
          Transaction Lookup
        </h3>
        <form method="GET" className="flex gap-3 items-end">
          <div className="flex-1 max-w-sm">
            <label
              htmlFor="receipt"
              className="block text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5"
            >
              Receipt Number
            </label>
            <div className="relative">
              <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-text-muted pointer-events-none" />
              <input
                id="receipt"
                name="receipt"
                type="text"
                defaultValue={receipt ?? ''}
                placeholder="e.g. REC-20260601-001"
                className="w-full bg-nx-elevated border border-nx-border rounded-nx-btn pl-9 pr-4 py-2 text-[13px] text-nx-text placeholder:text-nx-text-faint focus:outline-none focus:border-nx-green transition-colors"
              />
            </div>
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 bg-nx-green hover:bg-nx-green-bright px-4 py-2 rounded-nx-btn text-[13px] font-semibold transition-all duration-150 active:scale-[0.97]"
            style={{ color: '#04210F' }}
          >
            <Search className="w-4 h-4" />
            Look Up
          </button>
          {receipt && (
            <a
              href="/app/returns"
              className="px-4 py-2 rounded-nx-btn text-[13px] font-medium text-nx-text-sec hover:text-nx-text border border-nx-border hover:bg-nx-elevated transition-colors"
            >
              Clear
            </a>
          )}
        </form>
      </div>

      {/* Not found */}
      {notFound && (
        <div className="bg-nx-surface border border-nx-red/20 rounded-nx-card px-5 py-8 flex flex-col items-center gap-2 mb-6 select-none">
          <RotateCcw className="w-8 h-8 text-nx-text-faint" />
          <p className="font-ui text-[14px] font-semibold text-nx-text-sec">
            Receipt not found
          </p>
          <p className="text-[12px] text-nx-text-muted">
            No completed transaction matches &ldquo;{receipt}&rdquo;. Check the receipt number and try again.
          </p>
        </div>
      )}

      {/* Sale found — read-only transaction detail */}
      {sale && (
        <div className="space-y-[14px]">
          {/* Transaction summary */}
          <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-ui text-[14px] font-semibold text-nx-text mb-1">
                  {sale.receipt_number}
                </h3>
                <p className="text-[12px] text-nx-text-sec">
                  {new Date(sale.completed_at).toLocaleString('en-GB', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-nx-green/10 text-nx-green">
                {sale.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-[13px] border-t border-nx-border/50 pt-4">
              <div>
                <p className="text-[11px] text-nx-text-muted uppercase tracking-wider mb-0.5">
                  Customer
                </p>
                <p className="text-nx-text font-medium">
                  {sale.customer?.full_name ?? 'Walk-in'}
                </p>
                {sale.customer?.phone && (
                  <p className="text-nx-text-sec text-[12px]">{sale.customer.phone}</p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-nx-text-muted uppercase tracking-wider mb-0.5">
                  Payment Method
                </p>
                <p className="text-nx-text font-medium capitalize">
                  {sale.payment_method.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-nx-text-muted uppercase tracking-wider mb-0.5">
                  Total Paid
                </p>
                <p className="font-data text-[16px] font-bold text-nx-text">
                  {fmt(Number(sale.total))}
                </p>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
            <div className="p-5 border-b border-nx-border">
              <h3 className="font-ui text-[13px] font-semibold text-nx-text">Items Purchased</h3>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-nx-elevated/50">
                  {['Item', 'SKU', 'Qty', 'Unit Price', 'Line Total'].map((h) => (
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
                {((sale.sale_lines ?? []) as any[]).map((line: any) => {
                  const variant = line.product_variants
                  const family = variant?.product_families
                  return (
                    <tr
                      key={line.id}
                      className="border-b border-nx-border/50 last:border-0"
                    >
                      <td className="py-3 px-5 text-[13px] text-nx-text">
                        {family?.name ?? '—'}
                        {variant?.size ? ` · ${variant.size}` : ''}
                        {variant?.color ? ` · ${variant.color}` : ''}
                      </td>
                      <td className="py-3 px-5 font-data text-[11px] text-nx-text-sec">
                        {variant?.sku ?? '—'}
                      </td>
                      <td className="py-3 px-5 font-data text-[13px] text-nx-text">
                        {line.quantity}
                      </td>
                      <td className="py-3 px-5 font-data text-[12px] text-nx-text">
                        {fmt(Number(line.unit_price))}
                      </td>
                      <td className="py-3 px-5 font-data text-[12px] font-semibold text-nx-text">
                        {fmt(Number(line.line_total))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Return form — disabled */}
          <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
            <h3 className="font-ui text-[13px] font-semibold text-nx-text mb-4">
              Return Details
            </h3>

            <div className="grid md:grid-cols-3 gap-4 mb-5 opacity-60 pointer-events-none select-none">
              <div>
                <label className="block text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
                  Return Reason
                </label>
                <select
                  disabled
                  className="w-full bg-nx-elevated border border-nx-border rounded-nx-btn px-3 py-2 text-[13px] text-nx-text-sec cursor-not-allowed"
                >
                  <option>Select reason…</option>
                  <option>Wrong size</option>
                  <option>Defective item</option>
                  <option>Customer changed mind</option>
                  <option>Incorrect item</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
                  Refund Method
                </label>
                <select
                  disabled
                  className="w-full bg-nx-elevated border border-nx-border rounded-nx-btn px-3 py-2 text-[13px] text-nx-text-sec cursor-not-allowed"
                >
                  <option>Select method…</option>
                  <option>Cash</option>
                  <option>Mobile Money</option>
                  <option>Store Credit</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
                  Restock Intent
                </label>
                <select
                  disabled
                  className="w-full bg-nx-elevated border border-nx-border rounded-nx-btn px-3 py-2 text-[13px] text-nx-text-sec cursor-not-allowed"
                >
                  <option>Restock item</option>
                  <option>Mark as damaged</option>
                  <option>Dispose</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-nx-border/50">
              <LockKeyhole className="w-4 h-4 text-nx-text-muted flex-shrink-0" />
              <p className="text-[12px] text-nx-text-muted">
                Return processing is not yet enabled. Submit functionality will activate once the
                Returns backend module is deployed.
              </p>
              <button
                disabled
                aria-disabled="true"
                title="Return processing not yet enabled"
                className="ml-auto flex-shrink-0 bg-nx-elevated border border-nx-border text-nx-text-muted px-5 py-2 rounded-nx-btn text-[13px] font-medium cursor-not-allowed opacity-60"
              >
                Process Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Default state — no search yet */}
      {!receipt && (
        <div className="bg-nx-surface border border-nx-border rounded-nx-card py-16 flex flex-col items-center gap-3 select-none">
          <RotateCcw className="w-10 h-10 text-nx-text-faint" />
          <p className="font-ui text-[14px] font-semibold text-nx-text-sec">
            Enter a receipt number to begin
          </p>
          <p className="text-[12px] text-nx-text-muted text-center max-w-xs">
            Look up any completed transaction by its receipt number to review the items and
            initiate a return.
          </p>
        </div>
      )}
    </div>
  )
}
