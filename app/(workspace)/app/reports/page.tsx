import { requireRole } from '@/lib/auth/session'
import { TrendingUp, BarChart2, Package, Users, AlertTriangle, UserCheck } from 'lucide-react'
import { getSalesSummary, getTopProducts, getLowStock, getCustomerCount, getCashierPerformance } from '@/lib/queries/reports'
import nextDynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import ExportButtons from '@/components/reports/export-buttons'

const RevenueChart = nextDynamic(() => import('@/components/charts/revenue-chart'), {
  loading: () => <Skeleton className="w-full h-full min-h-[300px] bg-nx-elevated/50" />
})

const SalesChart = nextDynamic(() => import('@/components/charts/sales-chart'), {
  loading: () => <Skeleton className="w-full h-full min-h-[300px] bg-nx-elevated/50" />
})

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const profile = await requireRole(['owner', 'manager'])
  
  // By default, fetch last 7 days
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  const branchId = profile.role === 'manager' ? profile.branch_id! : undefined

  // Parallel fetch queries
  const [salesSummary, topProducts, lowStock, customerCount, cashierPerformance] = await Promise.all([
    getSalesSummary(startDate, endDate, branchId),
    getTopProducts(startDate, endDate, branchId, 5),
    getLowStock(branchId, 10),
    getCustomerCount(),
    getCashierPerformance(startDate, endDate, branchId)
  ])

  // Process data for charts
  const revenueData = salesSummary.rawData.map((sale: any) => ({
    date: new Date(sale.completed_at).toLocaleDateString('en-US', { weekday: 'short' }),
    revenue: Number(sale.total)
  }))

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(val)
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      <div className="flex items-center justify-between mb-8 pt-6">
        <div>
          <h1 className="font-ui text-2xl font-bold text-nx-text flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-nx-cyan" />
            Analytics & Reports
          </h1>
          <p className="text-nx-text-sec text-xs mt-1">
            Comprehensive breakdown of business performance and stock valuation.
          </p>
        </div>
        <ExportButtons 
          salesData={salesSummary.rawData} 
          lowStockData={lowStock} 
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-ui text-xs font-semibold text-nx-text-sec uppercase tracking-wider">7-Day Revenue</span>
            <TrendingUp className="w-4 h-4 text-nx-gold" />
          </div>
          <p className="font-data text-2xl font-bold text-nx-text">{formatCurrency(salesSummary.revenue)}</p>
        </div>
        
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-ui text-xs font-semibold text-nx-text-sec uppercase tracking-wider">7-Day Profit</span>
            <TrendingUp className="w-4 h-4 text-nx-gold" />
          </div>
          <p className="font-data text-2xl font-bold text-nx-text">{formatCurrency(salesSummary.profit)}</p>
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-ui text-xs font-semibold text-nx-text-sec uppercase tracking-wider">Total Customers</span>
            <Users className="w-4 h-4 text-nx-cyan" />
          </div>
          <p className="font-data text-2xl font-bold text-nx-text">{customerCount}</p>
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-ui text-xs font-semibold text-nx-text-sec uppercase tracking-wider">7-Day Orders</span>
            <Package className="w-4 h-4 text-nx-cyan" />
          </div>
          <p className="font-data text-2xl font-bold text-nx-text">{salesSummary.orders}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <h3 className="font-ui text-sm font-semibold text-nx-text mb-6">Revenue Trend (7 Days)</h3>
          <RevenueChart data={revenueData} height={300} />
        </div>
        
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <h3 className="font-ui text-sm font-semibold text-nx-text mb-6">Top Selling Products</h3>
          <SalesChart data={topProducts.map(p => ({ name: p.name.slice(0, 15), orders: p.qty }))} height={300} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Top Products Table */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden lg:col-span-2">
          <div className="p-5 border-b border-nx-border flex items-center gap-2">
            <Package className="w-4 h-4 text-nx-cyan" />
            <h3 className="font-ui text-sm font-semibold text-nx-text">Top Products Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-nx-elevated/50 text-xs uppercase text-nx-text-sec font-ui tracking-wider">
                <tr>
                  <th className="px-5 py-3 border-b border-nx-border font-semibold">Product Name</th>
                  <th className="px-5 py-3 border-b border-nx-border font-semibold">Brand</th>
                  <th className="px-5 py-3 border-b border-nx-border font-semibold text-right">Units Sold</th>
                  <th className="px-5 py-3 border-b border-nx-border font-semibold text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nx-border/50">
                {topProducts.map((p, i) => (
                  <tr key={i} className="hover:bg-nx-elevated transition-colors">
                    <td className="px-5 py-4 text-nx-text font-ui">{p.name}</td>
                    <td className="px-5 py-4 text-nx-text-sec font-ui">{p.brand}</td>
                    <td className="px-5 py-4 text-nx-text text-right font-data">{p.qty}</td>
                    <td className="px-5 py-4 text-nx-text text-right font-data">{formatCurrency(p.revenue)}</td>
                  </tr>
                ))}
                {topProducts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-nx-text-sec font-ui">No sales data found for the selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Table */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
          <div className="p-5 border-b border-nx-border flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h3 className="font-ui text-sm font-semibold text-nx-text">Low Stock Radar</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-nx-elevated/50 text-xs uppercase text-nx-text-sec font-ui tracking-wider">
                <tr>
                  <th className="px-5 py-3 border-b border-nx-border font-semibold">Product</th>
                  <th className="px-5 py-3 border-b border-nx-border font-semibold text-right">On Hand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nx-border/50">
                {lowStock.map((p, i) => (
                  <tr key={i} className="hover:bg-nx-elevated transition-colors">
                    <td className="px-5 py-4">
                      <div className="text-nx-text font-ui truncate max-w-[150px]">{p.name}</div>
                      <div className="text-[10px] text-nx-text-sec font-data">{p.sku}</div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-data text-orange-500">{p.onHand}</span>
                      <span className="text-[10px] text-nx-text-sec ml-1">/ {p.threshold}</span>
                    </td>
                  </tr>
                ))}
                {lowStock.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-5 py-8 text-center text-nx-text-sec font-ui">Stock levels are healthy.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cashier Performance Table */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden mb-6">
        <div className="p-5 border-b border-nx-border flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-nx-cyan" />
          <h3 className="font-ui text-sm font-semibold text-nx-text">Cashier Performance (7 Days)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-nx-elevated/50 text-xs uppercase text-nx-text-sec font-ui tracking-wider">
              <tr>
                <th className="px-5 py-3 border-b border-nx-border font-semibold">Cashier</th>
                <th className="px-5 py-3 border-b border-nx-border font-semibold text-right">Transactions</th>
                <th className="px-5 py-3 border-b border-nx-border font-semibold text-right">Revenue Managed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-border/50">
              {cashierPerformance.map((c, i) => (
                <tr key={i} className="hover:bg-nx-elevated transition-colors">
                  <td className="px-5 py-4 text-nx-text font-ui flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-nx-elevated flex items-center justify-center text-[10px] font-bold text-nx-cyan">
                      {c.name.charAt(0)}
                    </div>
                    {c.name}
                  </td>
                  <td className="px-5 py-4 text-nx-text text-right font-data">{c.orders}</td>
                  <td className="px-5 py-4 text-nx-text text-right font-data">{formatCurrency(c.revenue)}</td>
                </tr>
              ))}
              {cashierPerformance.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-nx-text-sec font-ui">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
