import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ClipboardList, Plus } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ filter?: string }> }

function getStartDate(filter: string): string {
  const now = new Date()
  if (filter === 'today') return now.toISOString().split('T')[0]
  if (filter === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
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

function statusChipClass(status: string): string {
  if (status === 'completed') return 'bg-nx-green/10 text-nx-green'
  if (status === 'voided') return 'bg-nx-red/10 text-nx-red'
  return 'bg-nx-amber/10 text-nx-amber'
}

function methodLabel(method: string): string {
  const map: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    mobile_money: 'Mobile Money',
    mpesa: 'M-Pesa',
    credit: 'Credit',
    split: 'Split',
  }
  return map[method] ?? method.replace(/_/g, ' ')
}

const FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'all', label: 'All Time' },
]

export default async function OrdersPage({ searchParams }: Props) {
  await requireRole(['owner', 'manager', 'cashier'])
  const { filter = 'today' } = await searchParams
  const startDate = getStartDate(filter)
  const filterLabel = FILTERS.find((f) => f.key === filter)?.label ?? 'All Time'

  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('sales')
    .select(
      'id, receipt_number, completed_at, total, status, payment_method, customer:customers(full_name)'
    )
    .gte('completed_at', startDate)
    .order('completed_at', { ascending: false })
    .limit(200)

  const sales = (raw ?? []) as any[]
  const completed = sales.filter((s) => s.status === 'completed')
  const voided = sales.filter((s) => s.status === 'voided')
  const revenue = completed.reduce((sum, s) => sum + Number(s.total), 0)
  const avgOrder = completed.length > 0 ? revenue / completed.length : 0

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Orders
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Sales history &amp; transaction log — {filterLabel}
          </p>
        </div>
        <Link
          href="/app/pos"
          className="bg-nx-green hover:bg-nx-green-bright px-4 py-2 rounded-nx-btn text-[13px] font-semibold transition-all duration-150 active:scale-[0.97] flex items-center gap-2"
          style={{ color: '#04210F' }}
        >
          <Plus className="w-4 h-4" />
          New Sale
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-nx-elevated rounded-nx-btn p-1 w-fit mb-6 select-none">
        {FILTERS.map(({ key, label }) => (
          <Link
            key={key}
            href={`?filter=${key}`}
            className={`px-4 py-1.5 text-[12px] font-medium rounded-[6px] transition-colors ${
              filter === key
                ? 'bg-nx-surface text-nx-text border border-nx-border shadow-sm'
                : 'text-nx-text-sec hover:text-nx-text'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-6 select-none">
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Total Orders
          </p>
          <p className="font-data text-[28px] font-bold text-nx-text">{sales.length}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">
            {completed.length} completed · {voided.length} voided
          </p>
        </div>
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Revenue
          </p>
          <p className="font-data text-[22px] font-bold text-nx-text">{fmt(revenue)}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">Completed sales only</p>
        </div>
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Avg Order
          </p>
          <p className="font-data text-[22px] font-bold text-nx-gold">{fmt(avgOrder)}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">Per completed transaction</p>
        </div>
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Voided
          </p>
          <p className="font-data text-[28px] font-bold text-nx-red">{voided.length}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">Cancelled transactions</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
        <div className="p-5 border-b border-nx-border flex items-center gap-2 select-none">
          <ClipboardList className="w-4 h-4 text-nx-text-sec" />
          <h3 className="font-ui text-[14px] font-semibold text-nx-text">Transaction Log</h3>
          <span className="ml-auto font-data text-[12px] text-nx-text-muted">
            {sales.length} record{sales.length !== 1 ? 's' : ''}
          </span>
        </div>

        {sales.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 select-none">
            <ClipboardList className="w-10 h-10 text-nx-text-faint" />
            <p className="font-ui text-[14px] font-semibold text-nx-text-sec">
              No orders for this period
            </p>
            <p className="text-[12px] text-nx-text-muted text-center max-w-xs">
              Try a wider date range or complete a sale at the POS to see it here.
            </p>
            <Link
              href="/app/pos"
              className="mt-2 text-[12px] font-medium text-nx-green hover:text-nx-green-bright transition-colors"
            >
              Go to Point of Sale →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-nx-elevated/50">
                  {['Receipt #', 'Customer', 'Method', 'Date / Time', 'Amount', 'Status'].map(
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
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-nx-elevated transition-colors duration-150 border-b border-nx-border/50 last:border-0"
                  >
                    <td className="py-3 px-5 font-data text-[12px] text-nx-text">
                      {sale.receipt_number}
                    </td>
                    <td className="py-3 px-5 font-ui text-[13px] text-nx-text">
                      {sale.customer?.full_name ?? (
                        <span className="text-nx-text-muted">Walk-in</span>
                      )}
                    </td>
                    <td className="py-3 px-5">
                      <span className="font-data text-[11px] text-nx-text-sec">
                        {methodLabel(sale.payment_method)}
                      </span>
                    </td>
                    <td className="py-3 px-5 font-data text-[12px] text-nx-text-sec">
                      {new Date(sale.completed_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-5 font-data text-[13px] text-nx-text font-semibold">
                      {fmt(Number(sale.total))}
                    </td>
                    <td className="py-3 px-5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusChipClass(
                          sale.status
                        )}`}
                      >
                        {sale.status}
                      </span>
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
