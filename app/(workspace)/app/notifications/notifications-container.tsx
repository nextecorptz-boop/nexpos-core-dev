'use client'

import React, { useState, useMemo } from 'react'
import { Info, AlertCircle, ShieldAlert, ArrowRight, Phone, RefreshCw, ShoppingCart, MessageSquare, Clipboard, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { determineTillRisk } from '@/lib/domain/risk'

interface NotificationsContainerProps {
  lowStockItems: any[]
  overdueCreditAccounts: any[]
  varianceSessions: any[]
  refundAnomalies: any[]
}

export function NotificationsContainer({
  lowStockItems,
  overdueCreditAccounts,
  varianceSessions,
  refundAnomalies
}: NotificationsContainerProps) {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all')

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  // Compile all alerts dynamically
  const alertsList = useMemo(() => {
    const list: any[] = []

    // 1. Low stock alerts (Critical or Warning)
    lowStockItems.forEach(item => {
      const isCritical = Number(item.stock_left) <= 0
      list.push({
        id: `stock-${item.id}`,
        type: 'stock',
        severity: isCritical ? 'critical' : 'warning',
        title: isCritical ? 'Variant Stock Depleted' : 'Low Stock Warning',
        message: `${item.name} (${item.sku}) has only ${item.stock_left} units remaining in warehouse (Threshold: ${item.low_stock_threshold}).`,
        actionLabel: 'Reorder Stock',
        actionUrl: `/app/purchases?supplierId=${item.supplier_id}&variantId=${item.id}&quantity=${Math.max(15, item.low_stock_threshold * 3)}`,
        timestamp: new Date().toISOString() // Live indicator
      })
    })

    // 2. Overdue credit accounts (Critical or Warning)
    overdueCreditAccounts.forEach(account => {
      const isCritical = Number(account.daysOverdue) > 30 || Number(account.balance_due) > 200000
      list.push({
        id: `credit-${account.id}`,
        type: 'credit',
        severity: isCritical ? 'critical' : 'warning',
        title: isCritical ? 'Critical Overdue Credit' : 'Overdue Credit Balance',
        message: `Customer ${account.customer?.full_name} owes TZS ${new Intl.NumberFormat('en-TZ').format(account.balance_due)} (Due: ${new Date(account.due_date).toLocaleDateString()}, ${account.daysOverdue} days overdue).`,
        actionLabel: 'Nudge WhatsApp',
        isWhatsApp: true,
        accountData: account,
        timestamp: account.updated_at || account.created_at
      })
    })

    // 3. Till variance sessions (Critical or Warning)
    varianceSessions.forEach(session => {
      const varianceVal = Math.abs(Number(session.variance || 0))
      const risk = determineTillRisk(varianceVal)
      const isCritical = risk === 'critical' || risk === 'high_risk'

      list.push({
        id: `till-${session.id}`,
        type: 'till',
        severity: isCritical ? 'critical' : 'warning',
        title: `Till Variance Flagged (${session.status === 'open' ? 'Open' : 'Closed'})`,
        message: `Cashier Shift Droo has a variance of TZS ${new Intl.NumberFormat('en-TZ').format(session.variance)} (Expected: ${new Intl.NumberFormat('en-TZ').format(session.expected_cash || 0)}, Counted: ${new Intl.NumberFormat('en-TZ').format(session.closing_float || 0)}).`,
        actionLabel: 'Audit Sessions',
        actionUrl: '/app/till',
        timestamp: session.closed_at || session.opened_at
      })
    })

    // 4. Refund anomalies (Critical)
    refundAnomalies.forEach(anomaly => {
      list.push({
        id: `refund-${anomaly.id}`,
        type: 'refund',
        severity: 'critical',
        title: 'Refund Security Anomaly',
        message: `Staff member ${anomaly.full_name} (${anomaly.email}) has processed ${anomaly.refundCount} refunds, triggering fraud heuristics.`,
        actionLabel: 'Audit Staff',
        actionUrl: '/app/staff-insights',
        timestamp: new Date().toISOString()
      })
    })

    return list.sort((a, b) => {
      // Sort critical first, then warnings
      const severityWeight = { critical: 3, warning: 2, info: 1 }
      return severityWeight[b.severity as 'critical' | 'warning'] - severityWeight[a.severity as 'critical' | 'warning']
    })
  }, [lowStockItems, overdueCreditAccounts, varianceSessions, refundAnomalies])

  // Filter alerts by severity tab
  const filteredAlerts = useMemo(() => {
    if (filterSeverity === 'all') return alertsList
    return alertsList.filter(a => a.severity === filterSeverity)
  }, [alertsList, filterSeverity])

  // WhatsApp nudge
  const handleWhatsAppNudge = (account: any) => {
    const phone = account.customer?.phone || ''
    const rawPhone = phone.replace(/[^0-9]/g, '')
    const formattedPhone = rawPhone.startsWith('0') ? '255' + rawPhone.slice(1) : rawPhone
    const formattedDate = account.due_date ? new Date(account.due_date).toLocaleDateString('en-GB') : 'N/A'
    const template = `Habari ${account.customer?.full_name}, hapa ni NEXPOS. Tunakukumbusha kulipia salio la mkopo TZS ${new Intl.NumberFormat('en-TZ').format(account.balance_due)} lililotakiwa kufikia tarehe ${formattedDate}. Tafadhali fanya malipo mapema. Asante!`
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(template)}`, '_blank')
  }

  // Count summaries
  const criticalCount = alertsList.filter(a => a.severity === 'critical').length
  const warningCount = alertsList.filter(a => a.severity === 'warning').length

  return (
    <div className="max-w-[1000px] mx-auto px-4 lg:px-6 pb-12 flex flex-col gap-6 font-ui">
      {/* Header Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 shrink-0 select-none">
        <div>
          <h1 className="text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Operational Alerts Radar
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Real-time heuristic anomaly alerts, credit defaults, stock shortages, and till variances
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-nx-border pb-3 select-none">
        {(['all', 'critical', 'warning'] as const).map(tab => {
          const count = tab === 'all' ? alertsList.length : tab === 'critical' ? criticalCount : warningCount
          return (
            <button
              key={tab}
              onClick={() => setFilterSeverity(tab)}
              className={`px-4 py-2 rounded-nx-btn text-[12px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                filterSeverity === tab
                  ? tab === 'critical' 
                    ? 'bg-nx-red text-white'
                    : tab === 'warning'
                    ? 'bg-orange-500 text-white'
                    : 'bg-nx-cyan text-white'
                  : 'bg-nx-surface hover:bg-nx-hover text-nx-text-sec border border-nx-border'
              }`}
            >
              <span>{tab} Alerts</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px] font-mono">
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Alerts Feed */}
      <div className="space-y-4">
        {filteredAlerts.map(alert => (
          <div 
            key={alert.id} 
            className={`border rounded-nx-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-150 ${
              alert.severity === 'critical'
                ? 'bg-nx-red/10 border-nx-red/20 hover:bg-nx-red/15'
                : 'bg-nx-orange/10 border-nx-orange/20 hover:bg-nx-orange/15'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {alert.severity === 'critical' ? (
                  <ShieldAlert className="w-5 h-5 text-nx-red" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                )}
              </div>
              <div>
                <h4 className={`text-[13px] font-bold ${
                  alert.severity === 'critical' ? 'text-nx-red' : 'text-nx-orange'
                }`}>
                  {alert.title}
                </h4>
                <p className={`text-[12px] mt-1 leading-relaxed ${
                  alert.severity === 'critical' ? 'text-nx-red' : 'text-nx-orange'
                }`}>
                  {alert.message}
                </p>
                <span className="text-[10px] text-nx-text-muted mt-2 block font-data">
                  Alert raised on {new Date(alert.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end">
              {alert.isWhatsApp ? (
                <button
                  onClick={() => handleWhatsAppNudge(alert.accountData)}
                  className="bg-nx-green hover:bg-nx-green/90 text-white font-semibold text-[12px] px-3.5 py-2 rounded-nx-btn flex items-center gap-1.5 transition-transform active:scale-95 shadow-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{alert.actionLabel}</span>
                </button>
              ) : (
                <Link
                  href={alert.actionUrl}
                  className="bg-nx-cyan hover:bg-nx-cyan/90 text-white font-semibold text-[12px] px-3.5 py-2 rounded-nx-btn flex items-center gap-1.5 transition-transform active:scale-95 shadow-sm"
                >
                  <span>{alert.actionLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        ))}

        {filteredAlerts.length === 0 && (
          <div className="bg-nx-surface border border-nx-border rounded-nx-card p-12 text-center select-none">
            <CheckCircle2 className="w-12 h-12 text-nx-green mx-auto mb-4" />
            <h3 className="font-bold text-[15px] text-nx-text">Radar Clean: Zero Issues Found</h3>
            <p className="text-[12px] text-nx-text-sec mt-1 max-w-sm mx-auto">
              Heuristic engines report normal operations. All stock thresholds, cash balances, and refund ratios are clean.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
