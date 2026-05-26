'use client'

import React, { useState, useMemo } from 'react'
import { Info, AlertTriangle, Users, Award, ShieldAlert, CheckCircle2, TrendingUp, Search } from 'lucide-react'
import { calculateStaffPerformanceScore } from '@/lib/domain/metrics'
import { detectRefundAnomaly } from '@/lib/domain/risk'

interface StaffInsightsContainerProps {
  initialProfiles: any[]
  initialSales: any[]
  initialReturns: any[]
}

export function StaffInsightsContainer({
  initialProfiles,
  initialSales,
  initialReturns
}: StaffInsightsContainerProps) {
  const isDemoMode = initialProfiles.length === 0
  const [searchQuery, setSearchQuery] = useState('')

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  // Demo fallback datasets
  const DEMO_PROFILES = useMemo(() => [
    { id: 'dprof-1', full_name: 'Fatma Kassim', role: 'manager', email: 'fatma@nexpos.com' },
    { id: 'dprof-2', full_name: 'Ally Salehe', role: 'cashier', email: 'ally@nexpos.com' },
    { id: 'dprof-3', full_name: 'Khamis Juma', role: 'cashier', email: 'khamis@nexpos.com' }
  ], [])

  const DEMO_SALES = useMemo(() => [
    ...Array.from({ length: 28 }, () => ({ cashier_id: 'dprof-2', total_amount: 85000, status: 'completed' })),
    ...Array.from({ length: 42 }, () => ({ cashier_id: 'dprof-1', total_amount: 110000, status: 'completed' })),
    ...Array.from({ length: 15 }, () => ({ cashier_id: 'dprof-3', total_amount: 72000, status: 'completed' }))
  ], [])

  const DEMO_RETURNS = useMemo(() => [
    { processed_by: 'dprof-2', total_refund: 45000 },
    { processed_by: 'dprof-2', total_refund: 35000 },
    { processed_by: 'dprof-2', total_refund: 55000 },
    { processed_by: 'dprof-2', total_refund: 25000 },
    { processed_by: 'dprof-2', total_refund: 60000 }, // 5 refunds -> High risk anomaly
    { processed_by: 'dprof-1', total_refund: 30000 }
  ], [])

  const profiles = isDemoMode ? DEMO_PROFILES : initialProfiles
  const sales = isDemoMode ? DEMO_SALES : initialSales
  const returns = isDemoMode ? DEMO_RETURNS : initialReturns

  // Compute staff aggregates using centralized domain rules
  const staffData = useMemo(() => {
    // Calculate average refund frequency across all cashiers
    const refundsPerCashier = profiles.map(p => {
      const cashierRefunds = returns.filter(r => r.processed_by === p.id).length
      return cashierRefunds
    })
    const averageRefundCount = refundsPerCashier.reduce((sum, count) => sum + count, 0) / (profiles.length || 1)

    return profiles.map(profile => {
      const cashierSales = sales.filter(s => s.cashier_id === profile.id && (s.status === 'completed' || s.status === 'partial'))
      const salesCount = cashierSales.length
      const revenue = cashierSales.reduce((sum, s) => sum + Number(s.total_amount), 0)
      
      const cashierRefunds = returns.filter(r => r.processed_by === profile.id)
      const refundCount = cashierRefunds.length
      const refundsValue = cashierRefunds.reduce((sum, r) => sum + Number(r.total_refund), 0)

      // Use centralized domain calculations
      const performanceScore = calculateStaffPerformanceScore(salesCount, revenue, refundCount)
      const refundAnomaly = detectRefundAnomaly(refundCount, averageRefundCount)

      return {
        ...profile,
        salesCount,
        revenue,
        refundCount,
        refundsValue,
        performanceScore,
        refundAnomaly
      }
    }).sort((a, b) => b.performanceScore - a.performanceScore)
  }, [profiles, sales, returns])

  // Filter staff data
  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return staffData
    const q = searchQuery.toLowerCase()
    return staffData.filter(s => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
  }, [staffData, searchQuery])

  // KPI summaries
  const kpis = useMemo(() => {
    const totalCashiers = profiles.length
    const topPerformer = staffData[0]?.full_name || 'N/A'
    const totalAnomalies = staffData.filter(s => s.refundAnomaly).length

    return {
      totalCashiers,
      topPerformer,
      totalAnomalies
    }
  }, [profiles, staffData])

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6 pb-12 flex flex-col gap-6 font-ui">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-nx-cyan/10 border border-nx-cyan/20 rounded-nx-card p-4 flex items-start gap-3 select-none">
          <Info className="w-5 h-5 text-nx-cyan shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[13px] font-bold text-nx-text">Demo Operations Dashboard Active</h4>
            <p className="text-[12px] text-nx-text-sec leading-relaxed">
              No staff profiles found in the database. NEXPOS is presenting pre-populated cashier profiles and mocked sales velocities.
            </p>
          </div>
        </div>
      )}

      {/* Header Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 shrink-0 select-none">
        <div>
          <h1 className="text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Staff Analytics & Anomaly Audit
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Auditing cashier performance indices, shift volumes, and refund anomalies using deterministic algorithms
          </p>
        </div>
      </div>

      {/* Zone 1 — KPI Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] shrink-0 select-none">
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-nx-cyan/10 flex items-center justify-center text-nx-cyan">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider">Active Staff Profiles</span>
            <h3 className="font-data text-[20px] font-bold text-nx-text mt-0.5">{kpis.totalCashiers}</h3>
          </div>
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-nx-gold/10 flex items-center justify-center text-nx-gold">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-nx-gold uppercase tracking-wider">Top Performing Cashier</span>
            <h3 className="text-[16px] font-bold text-nx-text mt-0.5 truncate max-w-[200px]" title={kpis.topPerformer}>
              {kpis.topPerformer}
            </h3>
          </div>
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Refund Anomalies Flagged</span>
            <h3 className="font-data text-[20px] font-bold text-red-600 mt-0.5">{kpis.totalAnomalies}</h3>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative w-full sm:w-[320px] select-none">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search cashier profile..."
          className="w-full bg-nx-surface border border-nx-border text-nx-text text-[13px] pl-9 pr-4 py-2 rounded-nx-btn focus:outline-none focus:border-nx-cyan transition-colors"
        />
      </div>

      {/* Zone 3 — Staff Table */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
        <div className="overflow-x-auto cursor-grab active:cursor-grabbing">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-nx-elevated border-b border-nx-border text-[11px] font-bold text-nx-text-sec uppercase tracking-wider">
                <th className="py-3 px-4 sticky left-0 bg-nx-elevated z-10">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-right">Transactions</th>
                <th className="py-3 px-4 text-right">Revenue Generated</th>
                <th className="py-3 px-4 text-right">Refunds Count</th>
                <th className="py-3 px-4 text-right">Refunds Value</th>
                <th className="py-3 px-4 text-center">Security Status</th>
                <th className="py-3 px-4 text-center w-[150px]">Performance Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-border/50 text-[13px]">
              {filteredStaff.map(staff => (
                <tr key={staff.id} className="hover:bg-nx-hover/20 transition-colors">
                  {/* Sticky Column */}
                  <td className="py-3.5 px-4 sticky left-0 bg-white z-10">
                    <div className="font-semibold text-nx-text">{staff.full_name}</div>
                    <div className="text-[10px] text-nx-text-sec">{staff.email}</div>
                  </td>
                  <td className="py-3.5 px-4 text-nx-text-sec uppercase text-[11px] font-bold tracking-wider">
                    {staff.role}
                  </td>
                  <td className="py-3.5 px-4 text-right font-data text-nx-text">
                    {staff.salesCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-data font-bold text-nx-text">
                    {formatCurrency(staff.revenue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-data text-nx-text-sec">
                    {staff.refundCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-data text-nx-text-sec">
                    {formatCurrency(staff.refundsValue)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {staff.refundAnomaly ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-red-500/10 text-red-600 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Anomaly Flagged
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-green-500/10 text-green-600 text-[10px] font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Clear Audit
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2 select-none">
                      <div className="flex-1 bg-nx-elevated h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            staff.performanceScore > 75 ? 'bg-green-500' :
                            staff.performanceScore > 50 ? 'bg-nx-gold' :
                            'bg-orange-500'
                          }`}
                          style={{ width: `${staff.performanceScore}%` }}
                        />
                      </div>
                      <span className="font-data font-bold text-[11.5px] min-w-[24px] text-right">
                        {staff.performanceScore}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-nx-text-muted">
                    No cashier analysis logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
