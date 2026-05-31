import { requireRole } from '@/lib/auth/session'
import { TrendingUp, BarChart2, Package, Download } from 'lucide-react'
import { getSalesSummary, getTopProducts, getInventoryValuation } from '@/lib/queries/reports'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const RevenueChart = dynamic(() => import('@/components/charts/revenue-chart'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full min-h-[300px] bg-nx-elevated/50" />
})

const SalesChart = dynamic(() => import('@/components/charts/sales-chart'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full min-h-[300px] bg-nx-elevated/50" />
})

const ExportButtons = dynamic(() => import('@/components/reports/export-buttons'), {
  ssr: false
})

export const dynamicConfig = 'force-dynamic'

export default async function ReportsPage() {
  const profile = await requireRole(['owner', 'manager'])
  
  // By default, fetch last 7 days
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  const branchId = profile.role === 'manager' ? profile.branch_id! : undefined

  // Parallel fetch queries
  const [salesSummary, topProducts, inventory] = await Promise.all([
    getSalesSummary(startDate, endDate, branchId),
    getTopProducts(startDate, endDate, branchId, 5),
    getInventoryValuation(branchId)
  ])

  // Process data for charts
  const revenueData = salesSummary.rawData.map((sale: any) => ({
    date: new Date(sale.sale_date).toLocaleDateString('en-US', { weekday: 'short' }),
    revenue: Number(sale.total_amount)
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
          inventoryData={inventory.items} 
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-ui text-xs font-semibold text-nx-text-sec uppercase">7-Day Revenue</span>
            <TrendingUp className="w-4 h-4 text-nx-cyan" />
          </div>
          <p className="font-data text-2xl font-bold text-nx-text">{formatCurrency(salesSummary.revenue)}</p>
        </div>
        
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-ui text-xs font-semibold text-nx-text-sec uppercase">7-Day Profit</span>
            <TrendingUp className="w-4 h-4 text-nx-gold" />
          </div>
          <p className="font-data text-2xl font-bold text-nx-text">{formatCurrency(salesSummary.profit)}</p>
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-ui text-xs font-semibold text-nx-text-sec uppercase">Inventory Value (Retail)</span>
            <Package className="w-4 h-4 text-nx-green" />
          </div>
          <p className="font-data text-2xl font-bold text-nx-text">{formatCurrency(inventory.totalRetailValue)}</p>
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

      {/* Top Products Table */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
        <div className="p-5 border-b border-nx-border">
          <h3 className="font-ui text-sm font-semibold text-nx-text">Top Products Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-nx-elevated/50 text-xs uppercase text-nx-text-sec">
              <tr>
                <th className="px-5 py-3 border-b border-nx-border font-semibold">Product Name</th>
                <th className="px-5 py-3 border-b border-nx-border font-semibold">Brand</th>
                <th className="px-5 py-3 border-b border-nx-border font-semibold text-right">Units Sold</th>
                <th className="px-5 py-3 border-b border-nx-border font-semibold text-right">Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-border/50">
              {topProducts.map((p, i) => (
                <tr key={i} className="hover:bg-nx-elevated transition-colors">
                  <td className="px-5 py-4 text-nx-text">{p.name}</td>
                  <td className="px-5 py-4 text-nx-text-sec">{p.brand}</td>
                  <td className="px-5 py-4 text-nx-text text-right font-data">{p.qty}</td>
                  <td className="px-5 py-4 text-nx-text text-right font-data">{formatCurrency(p.revenue)}</td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-nx-text-sec">No sales data found for the selected period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
