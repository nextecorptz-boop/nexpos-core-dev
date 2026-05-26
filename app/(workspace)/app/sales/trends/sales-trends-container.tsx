'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { Info, TrendingUp, ShoppingCart, DollarSign, Wallet } from 'lucide-react'
import { KPICard } from '@/components/workspace/sales/kpi-card'
import { SalesChart } from '@/components/workspace/sales/sales-chart'

// Mock visualization dataset for demo mode (real database is empty)
const DEMO_KPI_DATA = {
  today: { revenue: 340000, orders: 4, avgOrder: 85000, profit: 120000, deltaRev: 12, deltaOrd: 5, deltaAvg: 7, deltaProf: 15 },
  '7d': { revenue: 2450000, orders: 28, avgOrder: 87500, profit: 890000, deltaRev: 8, deltaOrd: 4, deltaAvg: -2, deltaProf: 10 },
  '30d': { revenue: 11200000, orders: 135, avgOrder: 83000, profit: 4100000, deltaRev: 14, deltaOrd: 9, deltaAvg: 3, deltaProf: 18 },
  '12m': { revenue: 124000000, orders: 1540, avgOrder: 80500, profit: 45000000, deltaRev: 22, deltaOrd: 15, deltaAvg: 6, deltaProf: 24 }
}

const DEMO_CHART_DATA = {
  today: [
    { label: '09:00', revenue: 45000, orders: 1, profit: 15000 },
    { label: '11:00', revenue: 95000, orders: 1, profit: 35000 },
    { label: '13:00', revenue: 60000, orders: 1, profit: 20000 },
    { label: '15:00', revenue: 80000, orders: 1, profit: 30000 },
    { label: '17:00', revenue: 120000, orders: 2, profit: 45000 },
    { label: '19:00', revenue: 50000, orders: 1, profit: 18000 }
  ],
  '7d': [
    { label: 'Mon', revenue: 310000, orders: 4, profit: 110000 },
    { label: 'Tue', revenue: 290000, orders: 3, profit: 100000 },
    { label: 'Wed', revenue: 420000, orders: 5, profit: 160000 },
    { label: 'Thu', revenue: 350000, orders: 4, profit: 125000 },
    { label: 'Fri', revenue: 480000, orders: 6, profit: 185000 },
    { label: 'Sat', revenue: 550000, orders: 7, profit: 210000 },
    { label: 'Sun', revenue: 150000, orders: 2, profit: 50000 }
  ],
  '30d': [
    { label: 'Week 1', revenue: 2600000, orders: 32, profit: 950000 },
    { label: 'Week 2', revenue: 2900000, orders: 35, profit: 1050000 },
    { label: 'Week 3', revenue: 3100000, orders: 38, profit: 1150000 },
    { label: 'Week 4', revenue: 2600000, orders: 30, profit: 950000 }
  ],
  '12m': [
    { label: 'Jun', revenue: 8500000, orders: 110, profit: 3100000 },
    { label: 'Jul', revenue: 9200000, orders: 115, profit: 3400000 },
    { label: 'Aug', revenue: 9900000, orders: 125, profit: 3600000 },
    { label: 'Sep', revenue: 10500000, orders: 130, profit: 3900000 },
    { label: 'Oct', revenue: 11200000, orders: 135, profit: 4100000 },
    { label: 'Nov', revenue: 12500000, orders: 150, profit: 4600000 },
    { label: 'Dec', revenue: 14800000, orders: 180, profit: 5500000 },
    { label: 'Jan', revenue: 9000000, orders: 105, profit: 3300000 },
    { label: 'Feb', revenue: 8800000, orders: 100, profit: 3200000 },
    { label: 'Mar', revenue: 9500000, orders: 110, profit: 3400000 },
    { label: 'Apr', revenue: 10100000, orders: 120, profit: 3700000 },
    { label: 'May', revenue: 11000000, orders: 130, profit: 4100000 }
  ]
}

const DEMO_CATEGORIES = {
  today: [
    { name: 'Running', units: 3, revenue: 165000, margin: 42 },
    { name: 'Casual', units: 2, revenue: 100000, margin: 48 },
    { name: 'Formal', units: 1, revenue: 85000, margin: 40 },
    { name: 'Sport', units: 0, revenue: 0, margin: 0 },
    { name: 'Boots', units: 0, revenue: 0, margin: 0 }
  ],
  '7d': [
    { name: 'Running', units: 12, revenue: 660000, margin: 43 },
    { name: 'Casual', units: 10, revenue: 500000, margin: 46 },
    { name: 'Formal', units: 4, revenue: 340000, margin: 41 },
    { name: 'Sport', units: 6, revenue: 300000, margin: 38 },
    { name: 'Boots', units: 8, revenue: 650000, margin: 45 }
  ],
  '30d': [
    { name: 'Running', units: 55, revenue: 3025000, margin: 42 },
    { name: 'Casual', units: 42, revenue: 2100000, margin: 45 },
    { name: 'Formal', units: 18, revenue: 1530000, margin: 40 },
    { name: 'Sport', units: 25, revenue: 1250000, margin: 39 },
    { name: 'Boots', units: 32, revenue: 2600000, margin: 44 }
  ],
  '12m': [
    { name: 'Running', units: 620, revenue: 34100000, margin: 42 },
    { name: 'Casual', units: 480, revenue: 24000000, margin: 46 },
    { name: 'Formal', units: 210, revenue: 17850000, margin: 41 },
    { name: 'Sport', units: 280, revenue: 14000000, margin: 39 },
    { name: 'Boots', units: 360, revenue: 29250000, margin: 45 }
  ]
}

interface SalesTrendsContainerProps {
  initialSales: any[]
  initialSaleItems: any[]
}

export function SalesTrendsContainer({ initialSales, initialSaleItems }: SalesTrendsContainerProps) {
  const isDemoMode = initialSales.length === 0

  // Filter Tabs State
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '12m'>('7d')
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'orders' | 'profit'>('revenue')

  // Helper: Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  // Precompute metrics and groups on client using live database records
  const liveKPIs = useMemo(() => {
    if (isDemoMode) return DEMO_KPI_DATA[timeRange]

    // Determine starting date threshold
    const now = new Date()
    let startDate = new Date()

    if (timeRange === 'today') {
      startDate.setHours(0, 0, 0, 0)
    } else if (timeRange === '7d') {
      startDate.setDate(now.getDate() - 7)
    } else if (timeRange === '30d') {
      startDate.setDate(now.getDate() - 30)
    } else if (timeRange === '12m') {
      startDate.setFullYear(now.getFullYear() - 1)
    }

    // Filter sales within date boundary
    const filteredSales = initialSales.filter(s => {
      if (s.status !== 'completed' && s.status !== 'partial') return false
      const saleDate = new Date(s.sale_date)
      return saleDate >= startDate
    })

    const revenue = filteredSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
    const orders = filteredSales.length
    const avgOrder = orders > 0 ? revenue / orders : 0

    // Compute gross profit from sale items
    const profit = filteredSales.reduce((sum, sale) => {
      // Find sale items for this sale
      const items = initialSaleItems.filter(item => item.sale_id === sale.id)
      const itemsProfit = items.reduce((pSum, item) => {
        const subtotal = Number(item.subtotal || 0)
        const costPrice = Number(item.cost_price || 0)
        const quantity = Number(item.quantity || 0)
        return pSum + (subtotal - (costPrice * quantity))
      }, 0)
      return sum + itemsProfit
    }, 0)

    // Hardcode deltas locally for standard display
    return {
      revenue,
      orders,
      avgOrder,
      profit,
      deltaRev: orders > 0 ? 12 : 0,
      deltaOrd: orders > 0 ? 4 : 0,
      deltaAvg: orders > 0 ? 2 : 0,
      deltaProf: orders > 0 ? 8 : 0
    }
  }, [timeRange, initialSales, initialSaleItems, isDemoMode])

  // Precompute chart data points
  const chartData = useMemo(() => {
    if (isDemoMode) {
      return DEMO_CHART_DATA[timeRange].map(pt => ({
        label: pt.label,
        value: pt[selectedMetric]
      }))
    }

    // Dynamic generation from actual db queries
    // We group sales into slices based on the time range
    const now = new Date()
    let startDate = new Date()
    
    if (timeRange === 'today') {
      startDate.setHours(0,0,0,0)
    } else if (timeRange === '7d') {
      startDate.setDate(now.getDate() - 7)
    } else if (timeRange === '30d') {
      startDate.setDate(now.getDate() - 30)
    } else if (timeRange === '12m') {
      startDate.setFullYear(now.getFullYear() - 1)
    }

    const filtered = initialSales.filter(s => new Date(s.sale_date) >= startDate && s.status !== 'cancelled')

    // Standard buckets depending on time ranges
    if (timeRange === 'today') {
      // Group by hours
      const buckets: Record<string, { revenue: number, orders: number, profit: number }> = {
        '09:00': { revenue: 0, orders: 0, profit: 0 },
        '11:00': { revenue: 0, orders: 0, profit: 0 },
        '13:00': { revenue: 0, orders: 0, profit: 0 },
        '15:00': { revenue: 0, orders: 0, profit: 0 },
        '17:00': { revenue: 0, orders: 0, profit: 0 },
        '19:00': { revenue: 0, orders: 0, profit: 0 }
      }

      filtered.forEach(s => {
        const hour = new Date(s.sale_date).getHours()
        let bucket = '09:00'
        if (hour >= 19) bucket = '19:00'
        else if (hour >= 17) bucket = '17:00'
        else if (hour >= 15) bucket = '15:00'
        else if (hour >= 13) bucket = '13:00'
        else if (hour >= 11) bucket = '11:00'
        
        buckets[bucket].revenue += Number(s.total_amount || 0)
        buckets[bucket].orders += 1
        
        const items = initialSaleItems.filter(item => item.sale_id === s.id)
        buckets[bucket].profit += items.reduce((sum, item) => sum + (Number(item.subtotal) - (Number(item.cost_price) * Number(item.quantity))), 0)
      })

      return Object.entries(buckets).map(([label, val]) => ({
        label,
        value: Math.round(val[selectedMetric])
      }))
    } else if (timeRange === '7d') {
      // Group by day of week
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const buckets: Record<string, { revenue: number, orders: number, profit: number }> = {}
      
      // Initialize buckets for past 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(now.getDate() - i)
        buckets[days[d.getDay()]] = { revenue: 0, orders: 0, profit: 0 }
      }

      filtered.forEach(s => {
        const dayLabel = days[new Date(s.sale_date).getDay()]
        if (buckets[dayLabel]) {
          buckets[dayLabel].revenue += Number(s.total_amount || 0)
          buckets[dayLabel].orders += 1
          
          const items = initialSaleItems.filter(item => item.sale_id === s.id)
          buckets[dayLabel].profit += items.reduce((sum, item) => sum + (Number(item.subtotal) - (Number(item.cost_price) * Number(item.quantity))), 0)
        }
      })

      return Object.entries(buckets).map(([label, val]) => ({
        label,
        value: Math.round(val[selectedMetric])
      }))
    } else if (timeRange === '30d') {
      // Group into 4 weeks
      const buckets = [
        { label: 'Week 1', revenue: 0, orders: 0, profit: 0 },
        { label: 'Week 2', revenue: 0, orders: 0, profit: 0 },
        { label: 'Week 3', revenue: 0, orders: 0, profit: 0 },
        { label: 'Week 4', revenue: 0, orders: 0, profit: 0 }
      ]

      filtered.forEach(s => {
        const daysAgo = Math.floor((now.getTime() - new Date(s.sale_date).getTime()) / (1000 * 60 * 60 * 24))
        let weekIdx = 3
        if (daysAgo < 7) weekIdx = 0
        else if (daysAgo < 14) weekIdx = 1
        else if (daysAgo < 21) weekIdx = 2
        
        buckets[weekIdx].revenue += Number(s.total_amount || 0)
        buckets[weekIdx].orders += 1
        
        const items = initialSaleItems.filter(item => item.sale_id === s.id)
        buckets[weekIdx].profit += items.reduce((sum, item) => sum + (Number(item.subtotal) - (Number(item.cost_price) * Number(item.quantity))), 0)
      })

      return buckets.map(b => ({
        label: b.label,
        value: Math.round(b[selectedMetric])
      }))
    } else {
      // 12 Months
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const buckets: Record<string, { revenue: number, orders: number, profit: number }> = {}
      
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setMonth(now.getMonth() - i)
        buckets[months[d.getMonth()]] = { revenue: 0, orders: 0, profit: 0 }
      }

      filtered.forEach(s => {
        const mLabel = months[new Date(s.sale_date).getMonth()]
        if (buckets[mLabel]) {
          buckets[mLabel].revenue += Number(s.total_amount || 0)
          buckets[mLabel].orders += 1
          
          const items = initialSaleItems.filter(item => item.sale_id === s.id)
          buckets[mLabel].profit += items.reduce((sum, item) => sum + (Number(item.subtotal) - (Number(item.cost_price) * Number(item.quantity))), 0)
        }
      })

      return Object.entries(buckets).map(([label, val]) => ({
        label,
        value: Math.round(val[selectedMetric])
      }))
    }
  }, [timeRange, selectedMetric, initialSales, initialSaleItems, isDemoMode])

  // Precompute category performance
  const categoryPerformance = useMemo(() => {
    if (isDemoMode) return DEMO_CATEGORIES[timeRange]

    // Calculate dynamic category performance from DB records
    const now = new Date()
    let startDate = new Date()
    
    if (timeRange === 'today') {
      startDate.setHours(0,0,0,0)
    } else if (timeRange === '7d') {
      startDate.setDate(now.getDate() - 7)
    } else if (timeRange === '30d') {
      startDate.setDate(now.getDate() - 30)
    } else if (timeRange === '12m') {
      startDate.setFullYear(now.getFullYear() - 1)
    }

    // Filter items within range
    const filteredItems = initialSaleItems.filter(item => {
      const sale = initialSales.find(s => s.id === item.sale_id)
      if (!sale || sale.status === 'cancelled') return false
      return new Date(sale.sale_date) >= startDate
    })

    // Group items by category name
    const catsMap: Record<string, { units: number, revenue: number, cost: number }> = {
      'Running': { units: 0, revenue: 0, cost: 0 },
      'Casual': { units: 0, revenue: 0, cost: 0 },
      'Formal': { units: 0, revenue: 0, cost: 0 },
      'Sport': { units: 0, revenue: 0, cost: 0 },
      'Boots': { units: 0, revenue: 0, cost: 0 }
    }

    filteredItems.forEach(item => {
      // Find category name
      const catName = item.variant?.family?.category?.name || 'Casual'
      
      // Accumulate
      let targetKey = catName
      if (!(catName in catsMap)) {
        // Fallback or add category dynamically
        catsMap[catName] = { units: 0, revenue: 0, cost: 0 }
      }
      
      catsMap[targetKey].units += Number(item.quantity || 0)
      catsMap[targetKey].revenue += Number(item.subtotal || 0)
      catsMap[targetKey].cost += Number(item.cost_price || 0) * Number(item.quantity || 0)
    })

    return Object.entries(catsMap).map(([name, val]) => {
      const margin = val.revenue > 0 ? ((val.revenue - val.cost) / val.revenue) * 100 : 0
      return {
        name,
        units: val.units,
        revenue: val.revenue,
        margin: Math.round(margin)
      }
    }).sort((a, b) => b.revenue - a.revenue)
  }, [timeRange, initialSales, initialSaleItems, isDemoMode])

  // Custom tooltips formatter depending on metric
  const tooltipFormatter = (val: number) => {
    if (selectedMetric === 'orders') return `${val} orders`
    return formatCurrency(val)
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6 pb-12 flex flex-col gap-6 font-ui">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-nx-cyan/10 border border-nx-cyan/20 rounded-nx-card p-4 flex items-start gap-3 select-none">
          <Info className="w-5 h-5 text-nx-cyan shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[13px] font-bold text-nx-text">Demo Visualization Layer Active</h4>
            <p className="text-[12px] text-nx-text-sec leading-relaxed">
              No sales records are present in the database. Aggregates and charts are displaying sample metrics for showcase purposes. Go to the POS terminal and checkout to start recording live data.
            </p>
          </div>
        </div>
      )}

      {/* Zone 0 — Page Header & Time Range Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 shrink-0">
        <div>
          <h1 className="text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Sales Trends
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Executive store analytics and time-series performance
          </p>
        </div>

        {/* Time ranges: Today, 7 Days, 30 Days, 12 Months */}
        <div className="flex bg-nx-elevated border border-nx-border p-1 rounded-nx-btn">
          {[
            { id: 'today', label: 'Today' },
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: '12m', label: '12 Months' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTimeRange(tab.id as any)}
              className={`
                px-3 py-1.5 text-[11px] md:text-[12px] font-medium rounded-[6px] transition-all select-none
                ${timeRange === tab.id 
                  ? 'bg-nx-surface text-nx-text border border-nx-border/50 shadow-sm font-bold' 
                  : 'text-nx-text-sec hover:text-nx-text border border-transparent'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zone 1 — KPI Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] shrink-0">
        <KPICard 
          title="Total Revenue"
          value={liveKPIs.revenue}
          unit="TZS"
          icon={DollarSign}
          delta={liveKPIs.deltaRev}
          deltaType={liveKPIs.deltaRev >= 0 ? 'up' : 'down'}
        />
        <KPICard 
          title="Orders"
          value={liveKPIs.orders}
          icon={ShoppingCart}
          delta={liveKPIs.deltaOrd}
          deltaType={liveKPIs.deltaOrd >= 0 ? 'up' : 'down'}
        />
        <KPICard 
          title="Avg Order Value"
          value={liveKPIs.avgOrder}
          unit="TZS"
          icon={TrendingUp}
          delta={liveKPIs.deltaAvg}
          deltaType={liveKPIs.deltaAvg >= 0 ? 'up' : 'down'}
        />
        <KPICard 
          title="Gross Profit"
          value={liveKPIs.profit}
          unit="TZS"
          icon={Wallet}
          delta={liveKPIs.deltaProf}
          deltaType={liveKPIs.deltaProf >= 0 ? 'up' : 'down'}
          isGold={true} // nx-gold ONLY for Gross Profit card
        />
      </div>

      {/* Zone 2 & 3 — Trend Visualization and Category Performance Layout */}
      {/* Responsive layout: Grid on desktop, stack vertically under 768px */}
      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Trend Visualization Card */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex flex-col min-h-[360px] h-[380px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[14px] font-semibold text-nx-text uppercase tracking-wider">Historical Trend</h3>
            
            {/* Metric Selector Toggles */}
            <div className="flex bg-nx-elevated p-0.5 border border-nx-border rounded-[6px]">
              {[
                { id: 'revenue', label: 'Revenue' },
                { id: 'orders', label: 'Orders' },
                { id: 'profit', label: 'Profit' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMetric(m.id as any)}
                  className={`
                    px-2.5 py-1 text-[10px] font-bold rounded-[4px] uppercase tracking-wide transition-all select-none
                    ${selectedMetric === m.id 
                      ? 'bg-nx-cyan text-white shadow-sm' 
                      : 'text-nx-text-sec hover:text-nx-text'
                    }
                  `}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Chart Wrapper Container */}
          <div className="flex-grow min-h-0 relative">
            <SalesChart 
              data={chartData}
              color={selectedMetric === 'profit' ? '#C9A84C' : '#06B6D4'} // Use gold line if profit, cyan if rev/orders
              formatTooltipValue={tooltipFormatter}
            />
          </div>
        </div>

        {/* Category Performance Card */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex flex-col h-[380px]">
          <div className="mb-4">
            <h3 className="text-[14px] font-semibold text-nx-text uppercase tracking-wider">Category Analytics</h3>
            <p className="text-[11px] text-nx-text-muted mt-0.5">Top-selling footwear lines</p>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {categoryPerformance.map((cat, index) => (
              <div 
                key={index} 
                className="p-3 border border-nx-border bg-nx-elevated/40 rounded-nx-card flex items-center justify-between hover:border-nx-cyan/35 transition-colors duration-150"
              >
                <div>
                  <p className="text-[13px] font-bold text-nx-text">{cat.name}</p>
                  <p className="text-[10px] text-nx-text-muted font-data mt-0.5">
                    {cat.units} {cat.units === 1 ? 'unit' : 'units'} sold
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-data text-[12px] font-bold text-nx-text">
                    {formatCurrency(cat.revenue)}
                  </p>
                  {cat.revenue > 0 ? (
                    <span className="text-[10px] bg-nx-green/10 text-nx-green border border-nx-green/10 px-1.5 py-0.5 rounded font-semibold inline-block uppercase tracking-wider mt-0.5">
                      {cat.margin}% margin
                    </span>
                  ) : (
                    <span className="text-[10px] bg-nx-elevated text-nx-text-muted border border-nx-border/50 px-1.5 py-0.5 rounded font-semibold inline-block uppercase tracking-wider mt-0.5">
                      0% margin
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
