'use client'

import React, { useState, useMemo } from 'react'
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { calculateStaffPerformanceScore } from '@/lib/domain/metrics'
import { detectRefundAnomaly } from '@/lib/domain/risk'

interface StaffInsightsContainerProps {
  initialProfiles: any[]
  initialSales: any[]
}

function fmt(val: number): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(val)
}

export function StaffInsightsContainer({
  initialProfiles,
  initialSales,
}: StaffInsightsContainerProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const staffData = useMemo(() => {
    // Anomaly detection: baseline is average refund count (no returns table yet — all zero)
    const avgRefundCount = 0

    return initialProfiles
      .map((profile) => {
        const cashierSales = initialSales.filter(
          (s) => s.cashier_id === profile.id && s.status === 'completed'
        )
        const salesCount = cashierSales.length
        const revenue = cashierSales.reduce((sum, s) => sum + Number(s.total), 0)
        const refundCount = 0
        const refundsValue = 0

        const performanceScore = calculateStaffPerformanceScore(salesCount, revenue, refundCount)
        const refundAnomaly = detectRefundAnomaly(refundCount, avgRefundCount)

        return {
          ...profile,
          salesCount,
          revenue,
          refundCount,
          refundsValue,
          performanceScore,
          refundAnomaly,
        }
      })
      .sort((a, b) => b.performanceScore - a.performanceScore)
  }, [initialProfiles, initialSales])

  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return staffData
    const q = searchQuery.toLowerCase()
    return staffData.filter(
      (s) =>
        s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    )
  }, [staffData, searchQuery])

  const topPerformer = staffData[0]?.full_name ?? null
  const totalAnomalies = staffData.filter((s) => s.refundAnomaly).length

  if (initialProfiles.length === 0) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 pb-12">
        <div className="flex items-center gap-2 mb-1 pt-6">
          <Users className="w-5 h-5 text-nx-green" />
          <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3]">
            Staff Insights
          </h1>
        </div>
        <p className="text-nx-text-sec text-[12px] mb-8">
          Cashier performance and sales attribution
        </p>
        <div className="bg-nx-surface border border-nx-border rounded-nx-card py-20 flex flex-col items-center gap-3 select-none">
          <Users className="w-10 h-10 text-nx-text-faint" />
          <p className="font-ui text-[14px] font-semibold text-nx-text-sec">
            No staff profiles found
          </p>
          <p className="text-[12px] text-nx-text-muted text-center max-w-xs">
            Active staff profiles will appear here once user accounts are created for your team
            members.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12 font-ui">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1 pt-6 select-none">
        <Users className="w-5 h-5 text-nx-green" />
        <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3]">
          Staff Insights
        </h1>
      </div>
      <p className="text-nx-text-sec text-[12px] mb-8 select-none">
        Cashier performance and sales attribution
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-6 select-none">
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-nx-green/10 flex items-center justify-center text-nx-green">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider">
              Active Staff
            </span>
            <p className="font-data text-[20px] font-bold text-nx-text mt-0.5">
              {initialProfiles.length}
            </p>
          </div>
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-nx-gold/10 flex items-center justify-center text-nx-gold">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-nx-gold uppercase tracking-wider">
              Top Performer
            </span>
            <p
              className="text-[15px] font-bold text-nx-text mt-0.5 truncate max-w-[200px]"
              title={topPerformer ?? ''}
            >
              {topPerformer ?? '—'}
            </p>
          </div>
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-nx-red/10 flex items-center justify-center text-nx-red">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-nx-red uppercase tracking-wider">
              Refund Anomalies
            </span>
            <p className="font-data text-[20px] font-bold text-nx-red mt-0.5">
              {totalAnomalies}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-[320px] mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-text-muted pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search cashier…"
          className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] pl-9 pr-4 py-2 rounded-nx-btn focus:outline-none focus:border-nx-green transition-colors"
        />
      </div>

      {/* Staff table */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-nx-elevated/50 border-b border-nx-border">
                {[
                  'Staff Member',
                  'Role',
                  'Transactions',
                  'Revenue',
                  'Security Status',
                  'Performance',
                ].map((h) => (
                  <th
                    key={h}
                    className="py-3 px-5 font-ui text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-border/50 text-[13px]">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-nx-text-muted text-[12px]">
                    No results for &ldquo;{searchQuery}&rdquo;
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => (
                  <tr
                    key={staff.id}
                    className="hover:bg-nx-elevated transition-colors duration-150"
                  >
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-nx-text">{staff.full_name}</p>
                      <p className="text-[10px] text-nx-text-muted">{staff.email}</p>
                    </td>
                    <td className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider text-nx-text-sec">
                      {staff.role}
                    </td>
                    <td className="py-3.5 px-5 font-data text-nx-text">{staff.salesCount}</td>
                    <td className="py-3.5 px-5 font-data font-bold text-nx-text">
                      {fmt(staff.revenue)}
                    </td>
                    <td className="py-3.5 px-5">
                      {staff.refundAnomaly ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-nx-red/10 text-nx-red text-[10px] font-bold uppercase tracking-wide">
                          <AlertTriangle className="w-3 h-3" />
                          Anomaly
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-nx-green/10 text-nx-green text-[10px] font-bold uppercase tracking-wide">
                          <CheckCircle2 className="w-3 h-3" />
                          Clear
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2 select-none">
                        <div className="flex-1 bg-nx-elevated h-1.5 rounded-full overflow-hidden max-w-[100px]">
                          <div
                            className={`h-full rounded-full ${
                              staff.performanceScore > 75
                                ? 'bg-nx-green'
                                : staff.performanceScore > 50
                                  ? 'bg-nx-gold'
                                  : 'bg-nx-red'
                            }`}
                            style={{ width: `${staff.performanceScore}%` }}
                          />
                        </div>
                        <span className="font-data text-[11px] font-bold text-nx-text-sec min-w-[28px]">
                          {staff.performanceScore}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
