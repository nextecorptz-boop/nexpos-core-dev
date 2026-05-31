import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import {
  TrendingUp,
  DollarSign,
  Package,
  Plus,
  ShoppingCart,
  Wallet,
  PackagePlus,
  UserPlus,
  ClipboardList,
  Activity,
} from 'lucide-react'
import Link from 'next/link'
import { forecastRevenue } from '@/lib/domain/forecast'
import { NxKpiCard } from '@/components/workspace/ui/nx-kpi-card'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const RevenueChart = dynamic(() => import('@/components/charts/revenue-chart'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full min-h-[250px] bg-nx-elevated/50" />
})

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  // Fetch today's sales summary with sale items for gross profit calculation
  const today = new Date().toISOString().split('T')[0]
  
  const { data: todaySales, count: todaySalesCount } = await supabase
    .from('sales')
    .select('id, total_amount, sale_items(subtotal, cost_price, quantity)', { count: 'exact' })
    .gte('sale_date', today)
    .eq('status', 'completed')

  const todaysRevenue = todaySales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0
  const orders = todaySalesCount || 0
  const avgOrder = orders > 0 ? todaysRevenue / orders : 0
  
  const grossProfit = todaySales?.reduce((sum, sale) => {
    const itemsProfit = sale.sale_items?.reduce((itemSum: number, item: any) => {
      return itemSum + (Number(item.subtotal) - (Number(item.cost_price) * Number(item.quantity)))
    }, 0) || 0
    return sum + itemsProfit
  }, 0) || 0

  // Count active products (Preserved query)
  const { count: productCount } = await supabase
    .from('product_families')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // Count customers (Preserved query)
  const { count: customerCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })

  // Recent sales
  const { data: recentSales } = await supabase
    .from('sales')
    .select('*, customer:customers(full_name), cashier:profiles!sales_cashier_id_fkey(full_name)')
    .order('sale_date', { ascending: false })
    .limit(10)

  // Fetch Cash Sessions for reconciliation metrics
  const { data: rawSessions } = await supabase
    .from('cash_sessions')
    .select('variance, status')

  const openSessionsCount = rawSessions?.filter(s => s.status === 'open').length || 0
  const totalVarianceVal = rawSessions?.reduce((sum, s) => sum + Number(s.variance || 0), 0) || 0

  // Fetch credit accounts for outstanding balance metrics
  const { data: creditAccounts } = await supabase
    .from('credit_accounts')
    .select('balance_due, due_date, status')

  const activeCreditAccounts = creditAccounts?.filter(a => a.status === 'active') || []
  const totalOutstandingCredit = activeCreditAccounts.reduce((sum, a) => sum + Number(a.balance_due), 0)

  // AI Advisory projections
  const monthlyProjectedRevenue = forecastRevenue(todaysRevenue * 30, 1.05)

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Zone 1: Greeting Strip */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Good morning, {user.full_name.split(' ')[0]}.
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/control-center" className="bg-nx-surface hover:bg-nx-hover border border-nx-border text-nx-text px-4 py-2 rounded-nx-btn flex items-center text-[13px] font-medium transition-all duration-150 active:scale-[0.97]">
            <Activity className="w-4 h-4 mr-2 text-nx-cyan" />
            Control Center
          </Link>
          <Link href="/app/pos" className="bg-nx-cyan hover:bg-nx-cyan/90 text-white px-4 py-2 rounded-nx-btn shadow-[0_1px_3px_rgba(0,0,0,0.30)] flex items-center text-[13px] font-medium transition-all duration-150 active:scale-[0.97]">
            <Plus className="w-4 h-4 mr-2" />
            New Sale
          </Link>
        </div>
      </div>

      {/* Zone 2: KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-[20px] select-none">
        <NxKpiCard
          label="Revenue"
          value={formatCurrency(todaysRevenue)}
          icon={DollarSign}
          iconColor="cyan"
          trend={{ direction: 'up', label: '12%' }}
        />
        <NxKpiCard
          label="Orders"
          value={String(orders)}
          icon={ShoppingCart}
          iconColor="cyan"
          trend={{ direction: 'up', label: '4%' }}
        />
        <NxKpiCard
          label="Avg Order"
          value={formatCurrency(avgOrder)}
          icon={TrendingUp}
          iconColor="cyan"
          trend={{ direction: 'down', label: '2%' }}
        />
        <NxKpiCard
          label="Gross Profit"
          value={formatCurrency(grossProfit)}
          icon={Wallet}
          iconColor="gold"
          trend={{ direction: 'up', label: '8%' }}
        />
      </div>

      {/* Zone 3: Analytics Row */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-[14px] mb-[20px] select-none">
        {/* Chart Panel */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-ui text-[14px] font-semibold text-nx-text">Sales Overview</h3>
            <div className="flex bg-nx-elevated rounded-nx-btn p-1">
              <button className="px-3 py-1 text-[11px] font-medium rounded-[6px] bg-nx-cyan text-white shadow-sm">Today</button>
              <button className="px-3 py-1 text-[11px] font-medium rounded-[6px] text-nx-text-sec hover:text-nx-text transition-colors">Week</button>
              <button className="px-3 py-1 text-[11px] font-medium rounded-[6px] text-nx-text-sec hover:text-nx-text transition-colors">Month</button>
            </div>
          </div>
          <div className="flex-1 min-h-[250px]">
            <RevenueChart data={[
              { date: 'Mon', revenue: todaysRevenue * 0.4 },
              { date: 'Tue', revenue: todaysRevenue * 0.6 },
              { date: 'Wed', revenue: todaysRevenue * 0.8 },
              { date: 'Thu', revenue: todaysRevenue * 0.5 },
              { date: 'Fri', revenue: todaysRevenue * 1.2 },
              { date: 'Sat', revenue: todaysRevenue * 1.5 },
              { date: 'Sun', revenue: todaysRevenue }
            ]} height={250} />
          </div>
        </div>

        {/* Top Products Panel */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex flex-col">
          <h3 className="font-ui text-[14px] font-semibold text-nx-text mb-4">Top Products</h3>
          <div className="flex-1 flex flex-col gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-nx-xs bg-nx-elevated flex items-center justify-center group-hover:bg-nx-cyan/10 transition-colors">
                    <Package className="w-4 h-4 text-nx-text-muted group-hover:text-nx-cyan transition-colors" />
                  </div>
                  <div>
                    <p className="font-ui text-[13px] font-medium text-nx-text">Product {i}</p>
                    <p className="font-ui text-[11px] text-nx-text-sec">NEXPOS Premium</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-data text-[12px] font-semibold text-nx-text">2{i}</p>
                  <p className="font-ui text-[10px] text-nx-text-muted">sold</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zone 6 & 7: Operational & AI Predictive Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[20px]">
        {/* Cash Session Status */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 select-none">
          <h4 className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-2.5">Till Sessions reconciliation</h4>
          <div className="flex items-center justify-between border-b border-nx-border/50 pb-2.5">
            <span className="text-[12.5px] text-nx-text-sec">Active Open Drawers</span>
            <span className="font-data font-bold text-nx-text">{openSessionsCount} Sessions</span>
          </div>
          <div className="flex items-center justify-between pt-2.5">
            <span className="text-[12.5px] text-nx-text-sec">Total Shift Variance</span>
            <span className={`font-data font-bold ${totalVarianceVal < 0 ? 'text-nx-red' : 'text-nx-text'}`}>
              {formatCurrency(totalVarianceVal)}
            </span>
          </div>
        </div>

        {/* Customer Credit defaults */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 select-none">
          <h4 className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-2.5">Customer Outstanding Ledger</h4>
          <div className="flex items-center justify-between border-b border-nx-border/50 pb-2.5">
            <span className="text-[12.5px] text-nx-text-sec">Active Debt Accounts</span>
            <span className="font-data font-bold text-nx-text">{activeCreditAccounts.length} Customers</span>
          </div>
          <div className="flex items-center justify-between pt-2.5">
            <span className="text-[12.5px] text-nx-text-sec">Outstanding Balances</span>
            <span className="font-data font-bold text-nx-text">{formatCurrency(totalOutstandingCredit)}</span>
          </div>
        </div>

        {/* AI Deterministic Forecasting */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 select-none relative overflow-hidden">
          <div className="flex items-center gap-1.5 text-nx-cyan mb-2.5">
            <Activity className="w-4 h-4" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider">AI Forecast & Runway (Advisory)</h4>
          </div>
          <div className="flex items-center justify-between border-b border-nx-border/50 pb-2.5">
            <span className="text-[12.5px] text-nx-text-sec">Projected 30D Revenue</span>
            <span className="font-data font-bold text-nx-text">{formatCurrency(monthlyProjectedRevenue)}</span>
          </div>
          <div className="flex items-center justify-between pt-2.5">
            <span className="text-[12.5px] text-nx-text-sec">Replenish Advise Radar</span>
            <span className="text-[11px] font-bold text-nx-gold">Awaiting stoki alerts</span>
          </div>
        </div>
      </div>

      {/* Zone 4: Recent Transactions */}
      <div className="mb-[20px]">
        <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
          <div className="p-5 border-b border-nx-border flex items-center justify-between select-none">
            <h3 className="font-ui text-[14px] font-semibold text-nx-text">Recent Transactions</h3>
            <Link href="/app/orders" className="text-[12px] text-nx-cyan hover:text-nx-cyan/80 font-medium transition-colors">
              View all
            </Link>
          </div>
          
          <div className="overflow-x-auto cursor-grab active:cursor-grabbing">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-nx-elevated/50">
                  <th className="py-3 px-5 font-ui text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border">Order ID</th>
                  <th className="py-3 px-5 font-ui text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border">Customer</th>
                  <th className="py-3 px-5 font-ui text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border hidden md:table-cell">Time</th>
                  <th className="py-3 px-5 font-ui text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border text-right">Amount</th>
                  <th className="py-3 px-5 font-ui text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSales && recentSales.length > 0 ? (
                  recentSales.slice(0, 5).map((sale: any) => (
                    <tr key={sale.id} className="hover:bg-nx-elevated transition-colors duration-150 border-b border-nx-border/50 last:border-0">
                      <td className="py-3 px-5 font-data text-[12px] text-nx-text">{sale.receipt_number}</td>
                      <td className="py-3 px-5 font-ui text-[13px] text-nx-text">{sale.customer?.full_name || 'Walk-in'}</td>
                      <td className="py-3 px-5 font-data text-[12px] text-nx-text-sec hidden md:table-cell">
                        {new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-5 font-data text-[12px] text-nx-text text-right">
                        {formatCurrency(sale.total_amount)}
                      </td>
                      <td className="py-3 px-5">
                        <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-nx-green/10 text-nx-green uppercase tracking-wide">
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[13px] text-nx-text-sec">
                      No recent transactions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Zone 5: Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px]">
        <Link href="/app/pos" className="bg-nx-surface border border-nx-border rounded-nx-card p-4 flex items-center gap-4 hover:border-nx-cyan/50 hover:shadow-nx-md transition-all duration-150 text-left active:scale-[0.97] group">
          <div className="w-[44px] h-[44px] rounded-full bg-nx-cyan/10 flex items-center justify-center shrink-0 group-hover:bg-nx-cyan group-hover:text-white transition-colors text-nx-cyan">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <span className="font-ui text-[14px] font-medium text-nx-text">New Sale</span>
        </Link>
        <Link href="/app/products" className="bg-nx-surface border border-nx-border rounded-nx-card p-4 flex items-center gap-4 hover:border-nx-cyan/50 hover:shadow-nx-md transition-all duration-150 text-left active:scale-[0.97] group">
          <div className="w-[44px] h-[44px] rounded-full bg-nx-cyan/10 flex items-center justify-center shrink-0 group-hover:bg-nx-cyan group-hover:text-white transition-colors text-nx-cyan">
            <PackagePlus className="w-5 h-5" />
          </div>
          <span className="font-ui text-[14px] font-medium text-nx-text">Add Product</span>
        </Link>
        <Link href="/app/customers" className="bg-nx-surface border border-nx-border rounded-nx-card p-4 flex items-center gap-4 hover:border-nx-cyan/50 hover:shadow-nx-md transition-all duration-150 text-left active:scale-[0.97] group">
          <div className="w-[44px] h-[44px] rounded-full bg-nx-cyan/10 flex items-center justify-center shrink-0 group-hover:bg-nx-cyan group-hover:text-white transition-colors text-nx-cyan">
            <UserPlus className="w-5 h-5" />
          </div>
          <span className="font-ui text-[14px] font-medium text-nx-text">Add Customer</span>
        </Link>
        <Link href="/app/inventory" className="bg-nx-surface border border-nx-border rounded-nx-card p-4 flex items-center gap-4 hover:border-nx-cyan/50 hover:shadow-nx-md transition-all duration-150 text-left active:scale-[0.97] group">
          <div className="w-[44px] h-[44px] rounded-full bg-nx-cyan/10 flex items-center justify-center shrink-0 group-hover:bg-nx-cyan group-hover:text-white transition-colors text-nx-cyan">
            <ClipboardList className="w-5 h-5" />
          </div>
          <span className="font-ui text-[14px] font-medium text-nx-text">Stock Check</span>
        </Link>
      </div>
    </div>
  )
}
