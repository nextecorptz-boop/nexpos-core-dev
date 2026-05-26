'use client'

import React, { useMemo, useState } from 'react'
import { Info, AlertCircle, TrendingUp, RefreshCw, Key, ShieldAlert, Users, Award, ShoppingBag, Layers, MessageSquare, Signal } from 'lucide-react'
import { useSyncStatus } from '@/lib/sync/use-sync-status'
import dynamic from 'next/dynamic'
const TelemetryDashboard = dynamic(
  () => import('@/components/workspace/telemetry-dashboard').then(mod => mod.TelemetryDashboard),
  { ssr: false }
)
import { forecastRevenue, forecastCashRunway } from '@/lib/domain/forecast'
import { calculateInventoryValuation, calculateOutstandingCredit, calculateStaffPerformanceScore } from '@/lib/domain/metrics'
import { determineTillRisk, determineCustomerCreditRisk, determineInventoryStatus } from '@/lib/domain/risk'

interface ControlCenterContainerProps {
  initialProducts: any[]
  initialStock: any[]
  initialSales: any[]
  initialExpenses: any[]
  initialCreditAccounts: any[]
  initialSessions: any[]
  initialProfiles: any[]
}

export function ControlCenterContainer({
  initialProducts,
  initialStock,
  initialSales,
  initialExpenses,
  initialCreditAccounts,
  initialSessions,
  initialProfiles
}: ControlCenterContainerProps) {
  const isDemoMode = initialProducts.length === 0
  const { isOnline, pendingCount, failedCount, triggerSync } = useSyncStatus()

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  // Demo fallback values if DB is empty
  const DEMO_SALES_TOTAL = 4500000
  const DEMO_EXPENSES_TOTAL = 850000
  const DEMO_OUTSTANDING_CREDIT = 600000
  const DEMO_TILL_VARIANCE = -15000

  // 1. Compute financial metrics
  const financialMetrics = useMemo(() => {
    if (isDemoMode) {
      const revenueForecast = forecastRevenue(DEMO_SALES_TOTAL, 1.08)
      const dailyBurn = DEMO_EXPENSES_TOTAL / 30
      const cashRunway = forecastCashRunway(2500000, dailyBurn)
      return {
        revenueForecast,
        dailyBurn,
        cashRunway,
        outstandingCredit: DEMO_OUTSTANDING_CREDIT,
        tillVariance: DEMO_TILL_VARIANCE
      }
    }

    // Live Metrics
    const completedSales = initialSales.filter(s => s.status === 'completed' || s.status === 'partial')
    const totalSales = completedSales.reduce((sum, s) => sum + Number(s.total_amount), 0)
    const revenueForecast = forecastRevenue(totalSales, 1.05) // Heuristic 5% growth projection

    const totalExpenses = initialExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const dailyBurn = totalExpenses / 30
    const cashRunway = forecastCashRunway(totalSales - totalExpenses, dailyBurn)

    const outstandingCredit = calculateOutstandingCredit(initialCreditAccounts)
    
    // Total variance in cashier sessions
    const tillVariance = initialSessions.reduce((sum, s) => sum + Number(s.variance || 0), 0)

    return {
      revenueForecast,
      dailyBurn,
      cashRunway,
      outstandingCredit,
      tillVariance
    }
  }, [initialSales, initialExpenses, initialCreditAccounts, initialSessions, isDemoMode])

  // 2. Compute stock risk
  const stockRisks = useMemo(() => {
    if (isDemoMode) {
      return {
        lowStockCount: 2,
        deadStockValuation: 280000,
        totalValuation: 1450000
      }
    }

    let lowStockCount = 0
    let deadStockValuation = 0

    // Compile inventory dataset to count alerts
    const inventoryDataset = initialProducts.flatMap(product => {
      return (product.variants || []).map((variant: any) => {
        const stockRecord = initialStock.find(s => s.variant_id === variant.id)
        const stockLeft = stockRecord ? Number(stockRecord.current_quantity) : 0
        return {
          id: variant.id,
          stock_left: stockLeft,
          low_stock_threshold: variant.low_stock_threshold || 5,
          cost_price: Number(variant.cost_price || product.base_cost || 45000)
        }
      })
    })

    inventoryDataset.forEach(item => {
      const status = determineInventoryStatus(item.stock_left, item.low_stock_threshold, 10) // Fallback sales
      if (status === 'low_stock' || status === 'critical') {
        lowStockCount++
      }
      if (status === 'dead_stock') {
        deadStockValuation += (item.stock_left * item.cost_price)
      }
    })

    const totalValuation = calculateInventoryValuation(initialStock.map(s => ({
      current_quantity: s.current_quantity,
      variant: { cost_price: s.cost_price }
    })))

    return {
      lowStockCount,
      deadStockValuation,
      totalValuation
    }
  }, [initialProducts, initialStock, isDemoMode])

  // 3. Compute collector priorities (Overdue credit accounts)
  const priorities = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const accounts = isDemoMode 
      ? [
          { id: '1', customer: { full_name: 'Juma Hamisi', phone: '+255712345678' }, balance_due: 200000, due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString() },
          { id: '2', customer: { full_name: 'Daudi Salim', phone: '+255655998877' }, balance_due: 400000, due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 35).toISOString() }
        ]
      : initialCreditAccounts.filter(a => a.status === 'active')

    return accounts.map(a => {
      const due = new Date(a.due_date)
      const daysOverdue = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
      return {
        ...a,
        daysOverdue
      }
    })
    .filter(a => a.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 3)
  }, [initialCreditAccounts, isDemoMode])

  // 4. Compute staff performance scores
  const staffContribution = useMemo(() => {
    const profiles = isDemoMode
      ? [
          { id: '1', full_name: 'Fatma Kassim', role: 'manager' },
          { id: '2', full_name: 'Ally Salehe', role: 'cashier' }
        ]
      : initialProfiles

    return profiles.map(p => {
      const cashierSales = initialSales.filter(s => s.cashier_id === p.id && s.status === 'completed')
      const count = cashierSales.length
      const revenue = cashierSales.reduce((sum, s) => sum + Number(s.total_amount), 0)
      
      // Calculate deterministic score
      const score = calculateStaffPerformanceScore(count, revenue, 0)

      return {
        id: p.id,
        full_name: p.full_name,
        role: p.role,
        score,
        count,
        revenue
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  }, [initialProfiles, initialSales, isDemoMode])

  const handleWhatsAppNudge = (account: any) => {
    const phone = account.customer?.phone || ''
    const rawPhone = phone.replace(/[^0-9]/g, '')
    const formattedPhone = rawPhone.startsWith('0') ? '255' + rawPhone.slice(1) : rawPhone
    const template = `Habari ${account.customer?.full_name}, hapa ni NEXPOS. Tunakukumbusha kulipia salio la mkopo TZS ${new Intl.NumberFormat('en-TZ').format(account.balance_due)}. Asante!`
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(template)}`, '_blank')
  }

  const [currentTab, setCurrentTab] = useState<'overview' | 'telemetry'>('overview')

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6 pb-12 flex flex-col gap-6 font-ui">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-nx-cyan/10 border border-nx-cyan/20 rounded-nx-card p-4 flex items-start gap-3 select-none">
          <Info className="w-5 h-5 text-nx-cyan shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[13px] font-bold text-nx-text">Demo Flagship Mode Active</h4>
            <p className="text-[12px] text-nx-text-sec leading-relaxed">
              No live products or sales data stored in database. NEXPOS is showcasing mock operations metrics inside this executive control center.
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-nx-border pb-1 select-none">
        <button
          onClick={() => setCurrentTab('overview')}
          className={`pb-2.5 px-4 font-semibold text-[13px] border-b-2 flex items-center gap-2 transition-all ${
            currentTab === 'overview' ? 'border-nx-cyan text-nx-text' : 'border-transparent text-nx-text-sec hover:text-nx-text'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-nx-cyan" />
          Executive Overview
        </button>
        <button
          onClick={() => setCurrentTab('telemetry')}
          className={`pb-2.5 px-4 font-semibold text-[13px] border-b-2 flex items-center gap-2 transition-all ${
            currentTab === 'telemetry' ? 'border-nx-cyan text-nx-text' : 'border-transparent text-nx-text-sec hover:text-nx-text'
          }`}
        >
          <Signal className="w-4 h-4 text-nx-cyan" />
          System Health & Telemetry
        </button>
      </div>

      {currentTab === 'telemetry' ? (
        <TelemetryDashboard />
      ) : (
        <>
          {/* Sync Queue & Network Status bar */}
      <div className="bg-nx-surface border border-nx-border p-4 rounded-nx-card flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${isOnline ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <Signal className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-[13.5px] text-nx-text">
              Platform Status: {isOnline ? 'ONLINE (SLA ACTIVE)' : 'OFFLINE MODE'}
            </h4>
            <p className="text-[11px] text-nx-text-sec">
              {pendingCount} transactions pending in local sync queue | {failedCount} execution errors
            </p>
          </div>
        </div>

        {pendingCount > 0 && (
          <button
            onClick={() => triggerSync()}
            className="bg-nx-cyan hover:bg-nx-cyan/90 text-white font-semibold text-[12px] px-4 py-2 rounded-nx-btn flex items-center gap-2 transition-transform active:scale-95"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Force Synch Now ({pendingCount})</span>
          </button>
        )}
      </div>

      {/* Grid: Financial & Operations Core */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Financial projections & forecast */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-6">
          <h3 className="font-bold text-[14px] text-nx-text border-b border-nx-border pb-3 flex items-center gap-2">
            <TrendingUp className="w-4.5 h-4.5 text-nx-cyan" />
            Financial Projections
          </h3>

          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Projected Month Revenue (30D Forecast)</span>
              <h4 className="font-data font-bold text-[20px] text-nx-text">
                {formatCurrency(financialMetrics.revenueForecast)}
              </h4>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Average Daily Burn Rate</span>
              <h4 className="font-data font-bold text-[16px] text-red-600">
                -{formatCurrency(financialMetrics.dailyBurn)}
              </h4>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Operating Runway Days</span>
              <h4 className="font-data font-bold text-[18px] text-nx-text">
                {financialMetrics.cashRunway} Days
              </h4>
            </div>
          </div>
        </div>

        {/* Center Column: Operations Health & Risk */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-6">
          <h3 className="font-bold text-[14px] text-nx-text border-b border-nx-border pb-3 flex items-center gap-2">
            <ShieldAlert className="w-4.5 h-4.5 text-nx-gold" />
            Operations Risk Radar
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-[13px]">
              <div>
                <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider block">Low Stock Variants</span>
                <span className="font-semibold text-nx-text mt-0.5 block">{stockRisks.lowStockCount} items below threshold</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                stockRisks.lowStockCount > 0 ? 'bg-orange-500/10 text-orange-600' : 'bg-green-500/10 text-green-600'
              }`}>
                {stockRisks.lowStockCount > 0 ? 'Shortages' : 'Healthy'}
              </span>
            </div>

            <div className="flex justify-between items-center text-[13px]">
              <div>
                <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider block">Dead Stock Value</span>
                <span className="font-data font-bold text-nx-text mt-0.5 block">{formatCurrency(stockRisks.deadStockValuation)}</span>
              </div>
              <span className="text-[10px] text-nx-text-muted font-data">Tied up capital</span>
            </div>

            <div className="flex justify-between items-center text-[13px]">
              <div>
                <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider block">Till Variance Total</span>
                <span className={`font-data font-bold mt-0.5 block ${
                  financialMetrics.tillVariance < 0 ? 'text-red-600' : 'text-nx-text'
                }`}>
                  {formatCurrency(financialMetrics.tillVariance)}
                </span>
              </div>
              <span className="text-[10px] text-nx-text-muted font-data">Reconciliations sum</span>
            </div>
          </div>
        </div>

        {/* Right Column: Collector Priorities (whatsapp list) */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-6">
          <h3 className="font-bold text-[14px] text-nx-text border-b border-nx-border pb-3 flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-nx-cyan" />
            Overdue Credit Priority
          </h3>

          <div className="space-y-3">
            {priorities.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 text-[13px] border-b border-nx-border/50 pb-2 last:border-b-0 last:pb-0">
                <div>
                  <div className="font-semibold text-nx-text">{p.customer?.full_name}</div>
                  <div className="text-[10px] text-red-600 font-data">
                    {formatCurrency(p.balance_due)} | {p.daysOverdue} days late
                  </div>
                </div>
                <button
                  onClick={() => handleWhatsAppNudge(p)}
                  className="p-1.5 hover:bg-nx-hover text-green-600 rounded transition-colors"
                  title="Nudge via WhatsApp"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            ))}

            {priorities.length === 0 && (
              <p className="text-center py-6 text-nx-text-muted text-[12px]">No immediate collection defaults</p>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Staff velocity & metrics details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Staff Contribution Index */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-4">
          <h3 className="font-bold text-[14px] text-nx-text border-b border-nx-border pb-3 flex items-center gap-2 select-none">
            <Award className="w-4.5 h-4.5 text-nx-gold" />
            Cashier Contribution index
          </h3>

          <div className="space-y-3">
            {staffContribution.map(staff => (
              <div key={staff.id} className="flex items-center justify-between gap-4 text-[13px] select-none">
                <div className="flex-1">
                  <div className="font-semibold text-nx-text">{staff.full_name} ({staff.role})</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-nx-elevated h-1.5 rounded-full overflow-hidden">
                      <div className="bg-nx-cyan h-full rounded-full" style={{ width: `${staff.score}%` }} />
                    </div>
                    <span className="font-data font-bold text-[11px] min-w-[20px] text-right">{staff.score}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-data font-bold text-nx-text">{formatCurrency(staff.revenue)}</div>
                  <div className="text-[10px] text-nx-text-sec font-data">{staff.count} sales completed</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Security & Audits alert radar summary */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-4 select-none">
          <h3 className="font-bold text-[14px] text-nx-text border-b border-nx-border pb-3 flex items-center gap-2">
            <ShieldAlert className="w-4.5 h-4.5 text-red-600" />
            Platform Alert Summary
          </h3>

          <div className="space-y-3 text-[12.5px] leading-relaxed text-nx-text-sec">
            <p>
              The control center monitors system-wide variances, low inventories, and refund patterns. Staff velocities are audited to optimize customer checkout waits.
            </p>
            <div className="p-3 bg-nx-elevated border border-nx-border rounded-nx-card text-[11.5px] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-nx-cyan shrink-0 mt-0.5" />
              <p>
                All forecasting metrics on this dashboard are strictly advisory heuristics. Automated ledger entries or inventory deletes are blocked by architectural isolation rules.
              </p>
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  )
}
