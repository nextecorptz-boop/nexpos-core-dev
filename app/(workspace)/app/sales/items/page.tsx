import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Package } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ range?: string; q?: string }> }

const RANGES = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'all', label: 'All Time' },
]

function getStartDate(range: string): string {
  const now = new Date()
  if (range === '7d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 6)
    return d.toISOString().split('T')[0]
  }
  if (range === '30d') {
    const d = new Date(now)
    d.setDate(d.getDate() - 29)
    return d.toISOString().split('T')[0]
  }
  return '2000-01-01'
}

function fmt(val: number): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(val)
}

type ItemStat = {
  variantId: string
  name: string
  sku: string
  unitsSold: number
  revenue: number
  avgPrice: number
  lastSold: string
}

export default async function SalesItemsPage({ searchParams }: Props) {
  await requireRole(['owner', 'manager'])
  const { range = '30d', q = '' } = await searchParams
  const startDate = getStartDate(range)

  const supabase = await createClient()

  // Step 1: fetch sale_lines joined to their sale's completed_at (filter completed sales)
  const { data: linesRaw } = await supabase
    .from('sale_lines')
    .select(
      'id, variant_id, quantity, unit_price, line_total, sale:sales!inner(completed_at, status)'
    )
    .eq('sale.status', 'completed')
    .gte('sale.completed_at', startDate)
    .limit(2000)

  const lines = (linesRaw ?? []) as any[]

  // Collect unique variant IDs
  const variantIds = [...new Set(lines.map((l) => l.variant_id as string).filter(Boolean))]

  // Step 2: fetch variant + family info separately
  const variantMap: Record<string, { sku: string; name: string }> = {}
  if (variantIds.length > 0) {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, sku, size, color, product_families(name)')
      .in('id', variantIds)

    for (const v of variants ?? []) {
      const family = (v as any).product_families
      const parts = [family?.name ?? 'Unknown']
      if (v.size) parts.push(v.size)
      if (v.color) parts.push(v.color)
      variantMap[v.id] = { sku: v.sku ?? '—', name: parts.join(' · ') }
    }
  }

  // Aggregate by variant
  const aggMap: Record<string, ItemStat> = {}
  for (const line of lines) {
    const vid = line.variant_id as string
    if (!vid) continue
    const info = variantMap[vid] ?? { sku: '—', name: vid }
    if (!aggMap[vid]) {
      aggMap[vid] = {
        variantId: vid,
        name: info.name,
        sku: info.sku,
        unitsSold: 0,
        revenue: 0,
        avgPrice: 0,
        lastSold: '',
      }
    }
    aggMap[vid].unitsSold += Number(line.quantity)
    aggMap[vid].revenue += Number(line.line_total)
    const saleDate = (line.sale as any)?.completed_at ?? ''
    if (saleDate > aggMap[vid].lastSold) aggMap[vid].lastSold = saleDate
  }

  // Compute avgPrice
  for (const item of Object.values(aggMap)) {
    item.avgPrice = item.unitsSold > 0 ? item.revenue / item.unitsSold : 0
  }

  let items = Object.values(aggMap).sort((a, b) => b.revenue - a.revenue)

  // Client-side search filter
  const qLower = q.trim().toLowerCase()
  if (qLower) {
    items = items.filter(
      (i) => i.name.toLowerCase().includes(qLower) || i.sku.toLowerCase().includes(qLower)
    )
  }

  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0)
  const totalUnits = items.reduce((s, i) => s + i.unitsSold, 0)

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-nx-green" />
            <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3]">
              Item Performance
            </h1>
          </div>
          <p className="text-nx-text-sec text-[12px]">
            Top selling products by revenue and units sold
          </p>
        </div>
        <Link
          href="/app/sales/trends"
          className="text-[12px] font-medium text-nx-text-sec hover:text-nx-text border border-nx-border px-4 py-2 rounded-nx-btn hover:bg-nx-elevated transition-colors"
        >
          Sales Trends →
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-1 bg-nx-elevated rounded-nx-btn p-1 w-fit select-none">
          {RANGES.map(({ key, label }) => (
            <Link
              key={key}
              href={`?range=${key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`px-4 py-1.5 text-[12px] font-medium rounded-[6px] transition-colors ${
                range === key
                  ? 'bg-nx-surface text-nx-text border border-nx-border shadow-sm'
                  : 'text-nx-text-sec hover:text-nx-text'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <form method="GET" className="flex gap-2 flex-1 max-w-xs">
          <input type="hidden" name="range" value={range} />
          <input
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Search item or SKU…"
            className="flex-1 bg-nx-elevated border border-nx-border rounded-nx-btn px-3 py-1.5 text-[13px] text-nx-text placeholder:text-nx-text-faint focus:outline-none focus:border-nx-green transition-colors"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-nx-elevated border border-nx-border rounded-nx-btn text-[12px] text-nx-text-sec hover:text-nx-text transition-colors"
          >
            Go
          </button>
          {q && (
            <Link
              href={`?range=${range}`}
              className="px-3 py-1.5 text-[12px] text-nx-text-muted hover:text-nx-text transition-colors"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-[14px] mb-6 select-none">
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Unique Items Sold
          </p>
          <p className="font-data text-[28px] font-bold text-nx-text">{items.length}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">Distinct product variants</p>
        </div>
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Total Units Sold
          </p>
          <p className="font-data text-[28px] font-bold text-nx-text">{totalUnits}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">Across all completed sales</p>
        </div>
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Total Item Revenue
          </p>
          <p className="font-data text-[22px] font-bold text-nx-green">{fmt(totalRevenue)}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">From line totals</p>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
        <div className="p-5 border-b border-nx-border flex items-center gap-2 select-none">
          <Package className="w-4 h-4 text-nx-text-sec" />
          <h3 className="font-ui text-[14px] font-semibold text-nx-text">Product Rankings</h3>
          <span className="ml-auto font-data text-[12px] text-nx-text-muted">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 select-none">
            <Package className="w-10 h-10 text-nx-text-faint" />
            <p className="font-ui text-[14px] font-semibold text-nx-text-sec">
              {q ? `No items matching "${q}"` : 'No item data for this period'}
            </p>
            <p className="text-[12px] text-nx-text-muted text-center max-w-xs">
              {q
                ? 'Try a different search term or clear the filter.'
                : 'Extend the date range or complete sales at the Point of Sale.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-nx-elevated/50">
                  {['#', 'Product', 'SKU', 'Units Sold', 'Avg Unit Price', 'Revenue', 'Last Sold'].map(
                    (h) => (
                      <th
                        key={h}
                        className="py-3 px-5 font-ui text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr
                    key={item.variantId}
                    className="hover:bg-nx-elevated transition-colors duration-150 border-b border-nx-border/50 last:border-0"
                  >
                    <td className="py-3 px-5 font-data text-[11px] text-nx-text-muted">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-5 font-ui text-[13px] text-nx-text font-medium">
                      {item.name}
                    </td>
                    <td className="py-3 px-5 font-data text-[11px] text-nx-text-muted">
                      {item.sku}
                    </td>
                    <td className="py-3 px-5 font-data text-[13px] text-nx-text font-semibold">
                      {item.unitsSold}
                    </td>
                    <td className="py-3 px-5 font-data text-[12px] text-nx-text-sec">
                      {fmt(item.avgPrice)}
                    </td>
                    <td className="py-3 px-5 font-data text-[13px] font-bold text-nx-green">
                      {fmt(item.revenue)}
                    </td>
                    <td className="py-3 px-5 font-data text-[12px] text-nx-text-muted">
                      {item.lastSold
                        ? new Date(item.lastSold).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
