'use client'

import React, { useState, useMemo } from 'react'
import { Info, AlertCircle, Play, CheckCircle2, List, Clipboard, ArrowDownRight, RefreshCw, Key, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { determineTillRisk } from '@/lib/domain/risk'

interface TillContainerProps {
  initialSessions: any[]
  initialCashPayments: any[]
  branchId: string
  userId: string
  cashierName: string
}

export function TillContainer({
  initialSessions,
  initialCashPayments,
  branchId,
  userId,
  cashierName
}: TillContainerProps) {
  const [sessions, setSessions] = useState<any[]>(initialSessions)
  const [cashPayments, setCashPayments] = useState<any[]>(initialCashPayments)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Drawer States
  const [openingFloat, setOpeningFloat] = useState('')
  const [countedFloat, setCountedFloat] = useState('')
  const [closeNotes, setCloseNotes] = useState('')

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  // Active open session
  const openSession = useMemo(() => {
    return sessions.find(s => s.status === 'open')
  }, [sessions])

  // Calculated cash sales for current open session
  const currentSessionCashSales = useMemo(() => {
    if (!openSession) return 0
    const openedTime = new Date(openSession.opened_at).getTime()
    return cashPayments
      .filter(p => {
        const paymentTime = new Date(p.paid_at).getTime()
        return paymentTime >= openedTime
      })
      .reduce((sum, p) => sum + Number(p.amount), 0)
  }, [openSession, cashPayments])

  const expectedCash = useMemo(() => {
    if (!openSession) return 0
    return Number(openSession.opening_float) + currentSessionCashSales
  }, [openSession, currentSessionCashSales])

  // Handle Open Till
  const handleOpenTill = async (e: React.FormEvent) => {
    e.preventDefault()
    const float = Number(openingFloat)
    if (float < 0 || openingFloat === '') {
      return alert('Tafadhali weka float sahihi (kuanzia 0).')
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('cash_sessions')
        .insert({
          branch_id: branchId,
          opened_by: userId,
          opening_float: float,
          status: 'open',
          opened_at: new Date().toISOString()
        })
        .select(`
          *,
          opened_by_user:profiles!cash_sessions_opened_by_fkey(full_name),
          closed_by_user:profiles!cash_sessions_closed_by_fkey(full_name)
        `)
        .single()

      if (error) throw error

      setSessions([data, ...sessions])
      setOpeningFloat('')
      alert('Kikao cha droo ya fedha kimefunguliwa kikamilifu!')
    } catch (e) {
      console.error(e)
      alert('Imeshindwa kufungua droo ya fedha.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Close & Reconcile Till
  const handleCloseTill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!openSession) return
    const actualCounted = Number(countedFloat)
    if (actualCounted < 0 || countedFloat === '') {
      return alert('Tafadhali weka kiasi halisi kilichohesabiwa drooni.')
    }

    const variance = actualCounted - expectedCash

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('cash_sessions')
        .update({
          closing_float: actualCounted,
          expected_cash: expectedCash,
          variance: variance,
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: userId,
          notes: closeNotes || 'Till session closed'
        })
        .eq('id', openSession.id)
        .select(`
          *,
          opened_by_user:profiles!cash_sessions_opened_by_fkey(full_name),
          closed_by_user:profiles!cash_sessions_closed_by_fkey(full_name)
        `)
        .single()

      if (error) throw error

      setSessions(sessions.map(s => s.id === openSession.id ? data : s))
      setCountedFloat('')
      setCloseNotes('')
      alert('Droo ya fedha imefungwa na kusawazishwa kikamilifu!')
    } catch (e) {
      console.error(e)
      alert('Imeshindwa kufunga droo ya fedha.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6 pb-12 flex flex-col gap-6 font-ui">
      {/* Header Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 shrink-0 select-none">
        <div>
          <h1 className="text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Till Reconciliation Desk
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Open cash drawers, reconcile shift balances, track variances, and audit cash flows
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left 2 Columns: Session Management (Current state or open form) */}
        <div className="lg:col-span-2 space-y-6">
          
          {openSession ? (
            /* Open Till Control Panel */
            <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-6">
              <div className="flex items-center justify-between border-b border-nx-border pb-4 select-none">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full bg-green-500 animate-pulse" />
                  <div>
                    <h3 className="font-bold text-[14px] text-nx-text">Till Session Open</h3>
                    <p className="text-[11px] text-nx-text-sec">
                      Opened by {openSession.opened_by_user?.full_name || cashierName} on {new Date(openSession.opened_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Balances dashboard */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-nx-elevated/40 border border-nx-border/50 p-4 rounded-nx-card">
                  <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Starting Float</span>
                  <h4 className="font-data font-bold text-[18px] text-nx-text mt-1.5">
                    {formatCurrency(openSession.opening_float)}
                  </h4>
                </div>

                <div className="bg-nx-elevated/40 border border-nx-border/50 p-4 rounded-nx-card">
                  <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Cash Sales (Shift)</span>
                  <h4 className="font-data font-bold text-[18px] text-nx-text mt-1.5">
                    {formatCurrency(currentSessionCashSales)}
                  </h4>
                </div>

                <div className="bg-nx-cyan/5 border border-nx-cyan/20 p-4 rounded-nx-card">
                  <span className="text-[10px] text-nx-cyan uppercase font-bold tracking-wider">Expected Cash</span>
                  <h4 className="font-data font-bold text-[18px] text-nx-cyan mt-1.5">
                    {formatCurrency(expectedCash)}
                  </h4>
                </div>
              </div>

              {/* Close Till Form */}
              <form onSubmit={handleCloseTill} className="space-y-4 pt-2">
                <h4 className="font-bold text-[13px] text-nx-text uppercase tracking-wider select-none">Close & Reconcile Drawer</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Counted Cash in Drawer *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-data font-bold text-nx-text-sec text-[13px]">TZS</span>
                      <input
                        type="number"
                        required
                        min={0}
                        value={countedFloat}
                        onChange={(e) => setCountedFloat(e.target.value)}
                        placeholder="Enter physical cash amount"
                        className="w-full bg-nx-elevated border border-nx-border text-nx-text font-data text-[13px] pl-12 pr-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Shift Notes / Explanations</label>
                    <input
                      type="text"
                      value={closeNotes}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      placeholder="e.g. Returned 20,000 to manager (optional)"
                      className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-nx-cyan hover:bg-nx-cyan/90 text-white font-semibold text-[13px] px-6 py-2.5 rounded-nx-btn flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Reconciling...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Submit Reconciliation & Close Till</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Open Till Form */
            <div className="bg-nx-surface border border-nx-border rounded-nx-card p-6 space-y-4">
              <div className="flex items-start gap-3 select-none">
                <div className="w-10 h-10 rounded-full bg-nx-cyan/10 flex items-center justify-center text-nx-cyan shrink-0">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[15px] text-nx-text">Open New Cash Drawer Session</h3>
                  <p className="text-[12px] text-nx-text-sec">
                    Enter the starting cash float (baba/change) to initialize checkout capabilities for this shift.
                  </p>
                </div>
              </div>

              <form onSubmit={handleOpenTill} className="flex flex-col sm:flex-row items-end gap-4 pt-2">
                <div className="space-y-1 flex-1">
                  <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Starting Float Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-data font-bold text-nx-text-sec text-[13px]">TZS</span>
                    <input
                      type="number"
                      required
                      min={0}
                      value={openingFloat}
                      onChange={(e) => setOpeningFloat(e.target.value)}
                      placeholder="e.g. 100000"
                      className="w-full bg-nx-elevated border border-nx-border text-nx-text font-data text-[13px] pl-12 pr-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-nx-cyan hover:bg-nx-cyan/90 text-white font-semibold text-[13px] px-6 py-3 rounded-nx-btn flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Opening...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Initialize Drawer Session</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Previous reconciled sessions list (horizontal scroll/sticky first column) */}
          <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
            <div className="p-4 border-b border-nx-border flex justify-between items-center select-none">
              <h3 className="font-bold text-[14px] text-nx-text">Till Reconciliation Logs</h3>
              <span className="text-[11px] text-nx-text-sec font-data">Shift Auditing Records</span>
            </div>

            <div className="overflow-x-auto cursor-grab active:cursor-grabbing">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-nx-elevated border-b border-nx-border text-[11px] font-bold text-nx-text-sec uppercase tracking-wider">
                    <th className="py-3 px-4 sticky left-0 bg-nx-elevated z-10">Cashier Name</th>
                    <th className="py-3 px-4">Opened At</th>
                    <th className="py-3 px-4">Closed At</th>
                    <th className="py-3 px-4 text-right">Start Float</th>
                    <th className="py-3 px-4 text-right">Expected Cash</th>
                    <th className="py-3 px-4 text-right">Counted Cash</th>
                    <th className="py-3 px-4 text-right">Variance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nx-border/50 text-[13px]">
                  {sessions.map(session => {
                    const varianceVal = Number(session.variance || 0)
                    const risk = determineTillRisk(varianceVal)

                    return (
                      <tr key={session.id} className="hover:bg-nx-hover/20 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-nx-text sticky left-0 bg-white z-10">
                          {session.opened_by_user?.full_name || cashierName}
                        </td>
                        <td className="py-3.5 px-4 text-nx-text-sec font-data">
                          {new Date(session.opened_at).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-nx-text-sec font-data">
                          {session.closed_at ? new Date(session.closed_at).toLocaleString() : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-data text-nx-text-sec">
                          {formatCurrency(session.opening_float)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-data text-nx-text-sec">
                          {session.expected_cash ? formatCurrency(session.expected_cash) : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-data text-nx-text">
                          {session.closing_float ? formatCurrency(session.closing_float) : '-'}
                        </td>
                        <td className={`py-3.5 px-4 text-right font-data font-bold ${
                          varianceVal < 0 ? 'text-red-600' : varianceVal > 0 ? 'text-green-600' : 'text-nx-text-sec'
                        }`}>
                          {session.closed_at ? formatCurrency(varianceVal) : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            session.status === 'open' ? 'bg-green-500/10 text-green-600' :
                            risk === 'critical' ? 'bg-red-500/10 text-red-600' :
                            risk === 'high_risk' ? 'bg-orange-500/10 text-orange-600' :
                            'bg-nx-cyan/10 text-nx-cyan'
                          }`}>
                            {session.status === 'open' ? 'open' : risk}
                          </span>
                        </td>
                      </tr>
                    )
                  })}

                  {sessions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-nx-text-muted">
                        No cashier till logs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Help Sidebar */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-4 select-none">
          <div className="flex items-center gap-2 text-nx-cyan">
            <Clipboard className="w-5 h-5" />
            <h3 className="font-bold text-[14px]">Reconciliation Standard</h3>
          </div>
          
          <div className="space-y-3 text-[12.5px] leading-relaxed text-nx-text-sec">
            <p>
              NEXPOS enforces strict cashier accountability. The drawer starting float is isolated upon clock-in. All sales payments are audited in real-time.
            </p>
            <div className="p-3 bg-nx-elevated/40 border border-nx-border/50 rounded-nx-card text-[11px] font-mono space-y-1">
              <span className="font-bold">Variance Calculation:</span>
              <p>Counted Cash - Expected Cash</p>
              <span className="font-bold mt-2 block">Risk Thresholds:</span>
              <p className="text-nx-gold font-bold">Watch: Variance &gt; 0 TZS</p>
              <p className="text-orange-600 font-bold">High: Variance &gt; 10,000 TZS</p>
              <p className="text-red-600 font-bold">Critical: Variance &gt; 50,000 TZS</p>
            </div>
            <p className="text-[11.5px] italic">
              All session reconciliation reports are uploaded to the audit logs immediately, noting user details and timestamps.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
