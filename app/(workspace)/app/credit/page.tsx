import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, LockKeyhole, Users } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function fmt(val: number): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(val)
}

export default async function CreditPage() {
  await requireRole(['owner', 'manager'])

  const supabase = await createClient()

  // Credit sales: sales recorded with payment_method = 'credit'.
  // Groups by customer to build a ledger of outstanding balances.
  const { data: raw } = await supabase
    .from('sales')
    .select(
      'id, receipt_number, completed_at, total, status, customer_id, customer:customers(full_name, phone)'
    )
    .eq('payment_method', 'credit')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(200)

  const creditSales = (raw ?? []) as any[]

  // Aggregate per customer
  const customerMap: Record<
    string,
    { name: string; phone: string | null; balance: number; count: number; lastDate: string }
  > = {}

  for (const sale of creditSales) {
    const cid = sale.customer_id ?? `walkIn:${sale.id}`
    if (!customerMap[cid]) {
      customerMap[cid] = {
        name: sale.customer?.full_name ?? 'Walk-in Customer',
        phone: sale.customer?.phone ?? null,
        balance: 0,
        count: 0,
        lastDate: sale.completed_at,
      }
    }
    customerMap[cid].balance += Number(sale.total)
    customerMap[cid].count += 1
    if (sale.completed_at > customerMap[cid].lastDate) {
      customerMap[cid].lastDate = sale.completed_at
    }
  }

  const ledger = Object.entries(customerMap)
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => b.balance - a.balance)

  const totalOutstanding = ledger.reduce((sum, c) => sum + c.balance, 0)
  const totalAccounts = ledger.length

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Credit
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Customer credit ledger — outstanding balances from credit sales
          </p>
        </div>
        <button
          disabled
          aria-disabled="true"
          title="Record credit sales via the Point of Sale"
          className="flex items-center gap-2 bg-nx-elevated border border-nx-border text-nx-text-muted px-4 py-2 rounded-nx-btn text-[13px] font-medium cursor-not-allowed opacity-60 select-none"
        >
          <LockKeyhole className="w-4 h-4" />
          Record Credit Sale
        </button>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-[14px] mb-6 select-none">
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Active Accounts
          </p>
          <p className="font-data text-[28px] font-bold text-nx-text">{totalAccounts}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">Customers with outstanding credit</p>
        </div>
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Total Outstanding
          </p>
          <p className="font-data text-[22px] font-bold text-nx-gold">{fmt(totalOutstanding)}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">Combined unpaid credit balance</p>
        </div>
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Credit Transactions
          </p>
          <p className="font-data text-[28px] font-bold text-nx-text">{creditSales.length}</p>
          <p className="text-[11px] text-nx-text-muted mt-1">Total credit sale records</p>
        </div>
      </div>

      {/* Credit ledger table */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden mb-6">
        <div className="p-5 border-b border-nx-border flex items-center gap-2 select-none">
          <Users className="w-4 h-4 text-nx-text-sec" />
          <h3 className="font-ui text-[14px] font-semibold text-nx-text">Customer Ledger</h3>
          <span className="ml-auto font-data text-[12px] text-nx-text-muted">
            {totalAccounts} account{totalAccounts !== 1 ? 's' : ''}
          </span>
        </div>

        {ledger.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 select-none">
            <CreditCard className="w-10 h-10 text-nx-text-faint" />
            <p className="font-ui text-[14px] font-semibold text-nx-text-sec">
              No credit sales recorded
            </p>
            <p className="text-[12px] text-nx-text-muted text-center max-w-xs">
              Credit sales are created at the Point of Sale by selecting &ldquo;Credit&rdquo; as
              the payment method. Customer accounts will appear here automatically.
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
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-nx-elevated/50">
                  {['Customer', 'Phone', 'Transactions', 'Last Credit Sale', 'Outstanding Balance'].map(
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
                {ledger.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-nx-elevated transition-colors duration-150 border-b border-nx-border/50 last:border-0"
                  >
                    <td className="py-3 px-5 font-ui text-[13px] text-nx-text font-medium">
                      {entry.name}
                    </td>
                    <td className="py-3 px-5 font-data text-[12px] text-nx-text-sec">
                      {entry.phone ?? '—'}
                    </td>
                    <td className="py-3 px-5 font-data text-[13px] text-nx-text text-center">
                      {entry.count}
                    </td>
                    <td className="py-3 px-5 font-data text-[12px] text-nx-text-sec">
                      {new Date(entry.lastDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-5 font-data text-[14px] font-bold text-nx-gold">
                      {fmt(entry.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer notice */}
      <div className="flex items-start gap-3 bg-nx-surface border border-nx-border/50 rounded-nx-card px-5 py-4 select-none">
        <LockKeyhole className="w-4 h-4 text-nx-text-muted flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-nx-text-muted leading-relaxed">
          This ledger shows outstanding balances derived from credit-method sales. Payment
          collection, balance settlement, and credit limit management will be available once the
          Credit Accounts backend module is activated.
        </p>
      </div>
    </div>
  )
}
