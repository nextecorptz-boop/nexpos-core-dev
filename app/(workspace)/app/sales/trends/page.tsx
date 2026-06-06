import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TrendingUp } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ range?: string }> }

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'all', label: 'All Time' },
]

function getStartDate(range: string): string {
  const now = new Date()
  if (range === 'today') return now.toISOString().split('T')[0]
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

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

type DayStat = { date: string; revenue: number; count: number }
type MethodStat = { method: string; revenue: number; count: number }

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile_money: 'Mobile Money',
  mpesa: 'M-Pesa',
  credit: 'Credit',
  split: 'Split',
}

export default async function SalesTrendsPage({ searchParams }: Props) {
  await requireRole(['owner', 'manager'])
  const { range = '7d' } = await searchParams
  const startDate = getStartDate(range)

  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('sales')
    .select('id, total, completed_at, payment_method, status')
    .gte('completed_at', startDate)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true })

  const sales = (raw ?? []) as any[]

  // Aggregate by day
  const dayMap: Record<string, DayStat> = {}
  for (const s of sales) {
    const day = (s.completed_at as string).split('T')[0]
    if (!dayMap[day]) dayMap[day] = { date: day, revenue: 0, count: 0 }
    dayMap[day].revenue += Number(s.total)
    dayMap[day].count += 1
  }
  const days = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))

  // Aggregate by payment method
  const methodMap: Record<string, MethodStat> = {}
  for (const s of sales) {
    const m = (s.payment_method as string) ?? 'unknown'
    if (!methodMap[m]) methodMap[m] = { method: m, revenue: 0, count: 0 }
    methodMap[m].revenue += Number(s.total)
    methodMap[m].count += 1
  }
  const methods = Object.values(methodMap).sort((a, b) => b.revenue - a.revenue)

  // KPIs
  const totalRevenue = sales.reduce((s, r) => s + Number(r.total), 0)
  const orderCount = sales.length
  const avgOrder = orderCount > 0 ? totalRevenue / orderCount : 0
  const bestDay =
    days.length > 0 ? days.reduce((best, d) => (d.revenue > best.revenue ? d : best), days[0]) : null
  const maxDayRevenue = days.length > 0 ? Math.max(...days.map((d) => d.revenue)) : 1

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-nx-green" />
            <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3]">
              Sales Trends
            </h1>
          </div>
          <p className="text-nx-text-sec text-[12px]">Revenue analysis over time</p>
        </div>
        <Link
          href="/app/sales/items"
          className="text-[12px] font-medium text-nx-text-sec hover:text-nx-text border border-nx-border px-4 py-2 rounded-nx-btn hover:bg-nx-elevated transition-colors"
        >
          Item Performance →
        </Link>
      </div>

      {/* Range filter */}
      <div className="flex gap-1 bg-nx-elevated rounded-nx-btn p-1 w-fit mb-6 select-none">
        {RANGES.map(({ key, label }) => (
          <Link
            key={key}
            href={`?range=${key}`}
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-6 select-none">
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Gross Sales
          </p>
          <p className="font-data text-[22px] font-bold text-nx-green">{fmt(totalRevenue)}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">Completed transactions only</p>
        </div>
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Order Count
          </p>
          <p className="font-data text-[28px] font-bold text-nx-text">{orderCount}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">
            {days.length} day{days.length !== 1 ? 's' : ''} with sales
          </p>
        </div>
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Avg Order Value
          </p>
          <p className="font-data text-[22px] font-bold text-nx-gold">{fmt(avgOrder)}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">Per completed transaction</p>
        </div>
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Best Day
          </p>
          {bestDay ? (
            <>
              <p className="font-data text-[22px] font-bold text-nx-text">{fmt(bestDay.revenue)}</p>
              <p className="text-[11px] text-nx-text-muted mt-1">{fmtDate(bestDay.date)}</p>
            </>
          ) : (
            <p className="font-data text-[22px] font-bold text-nx-text-muted">—</p>
          )}
        </div>
      </div>

      {sales.length === 0 ? (
        <div className="bg-nx-surface border border-nx-border rounded-nx-card py-20 flex flex-col items-center gap-3 select-none">
          <TrendingUp className="w-10 h-10 text-nx-text-faint" />
          <p className="font-ui text-[14px] font-semibold text-nx-text-sec">
            No sales in this period
          </p>
          <p className="text-[12px] text-nx-text-muted text-center max-w-xs">
            Try a wider date range, or complete a sale at the Point of Sale.
          </p>
          <Link
            href="/app/pos"
            className="mt-2 text-[12px] font-medium text-nx-green hover:text-nx-green-bright transition-colors"
          >
            Go to Point of Sale →
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_280px] gap-[14px]">
          {/* Daily trend table */}
          <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
            <div className="p-5 border-b border-nx-border select-none">
              <h3 className="font-ui text-[14px] font-semibold text-nx-text">Daily Revenue</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[480px]">
                <thead>
                  <tr className="bg-nx-elevated/50">
                    {['Date', 'Orders', 'Revenue', 'Share'].map((h) => (
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
                  {days.map((day) => {
                    const barPct = maxDayRevenue > 0 ? (day.revenue / maxDayRevenue) * 100 : 0
                    return (
                      <tr
                        key={day.date}
                        className="border-b border-nx-border/50 last:border-0 hover:bg-nx-elevated transition-colors"
                      >
                        <td className="py-3 px-5 font-data text-[12px] text-nx-text-sec whitespace-nowrap">
                          {fmtDate(day.date)}
                        </td>
                        <td className="py-3 px-5 font-data text-[13px] text-nx-text">
                          {day.count}
                        </td>
                        <td className="py-3 px-5 font-data text-[13px] font-semibold text-nx-text whitespace-nowrap">
                          {fmt(day.revenue)}
                        </td>
                        <td className="py-3 px-5 w-[140px]">
                          <div className="h-2 bg-nx-elevated rounded-full overflow-hidden">
                            <div
                              className="h-full bg-nx-green rounded-full"
                              style={{ width: `${barPct.toFixed(1)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment method breakdown */}
          <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
            <div className="p-5 border-b border-nx-border select-none">
              <h3 className="font-ui text-[14px] font-semibold text-nx-text">
                Payment Methods
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {methods.map((m) => {
                const pct = totalRevenue > 0 ? (m.revenue / totalRevenue) * 100 : 0
                return (
                  <div key={m.method}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-ui text-[12px] font-medium text-nx-text">
                        {METHOD_LABELS[m.method] ?? m.method.replace(/_/g, ' ')}
                      </span>
                      <span className="font-data text-[11px] text-nx-text-muted">
                        {m.count} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-nx-elevated rounded-full overflow-hidden mb-0.5">
                      <div
                        className="h-full bg-nx-gold rounded-full"
                        style={{ width: `${pct.toFixed(1)}%` }}
                      />
                    </div>
                    <p className="font-data text-[11px] text-nx-text-sec">{fmt(m.revenue)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
