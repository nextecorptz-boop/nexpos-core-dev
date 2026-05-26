'use client'

import React, { useState, useMemo } from 'react'
import { Info, AlertCircle, Clock, Check, Loader2, Phone, MessageSquare, Plus, DollarSign, Calendar, Search } from 'lucide-react'
import { addToSyncQueue } from '@/lib/sync/sync-engine'
import { useSyncStatus } from '@/lib/sync/use-sync-status'
import { determineCustomerCreditRisk } from '@/lib/domain/risk'
import { calculateOutstandingCredit } from '@/lib/domain/metrics'

interface CreditContainerProps {
  initialAccounts: any[]
  initialRepayments: any[]
  branchId: string
}

export function CreditContainer({
  initialAccounts,
  initialRepayments,
  branchId
}: CreditContainerProps) {
  const isDemoMode = initialAccounts.length === 0
  const { isOnline } = useSyncStatus()

  // State Management
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatusTab, setSelectedStatusTab] = useState<'all' | 'active' | 'overdue' | 'paid'>('all')
  const [selectedAccount, setSelectedAccount] = useState<any>(null)
  const [isRepayOpen, setIsRepayOpen] = useState(false)
  const [repaymentAmount, setRepaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card' | 'bank_transfer'>('cash')
  const [referenceCode, setReferenceCode] = useState('')
  const [repaymentNotes, setRepaymentNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Demo fallback data
  const DEMO_ACCOUNTS = useMemo(() => [
    {
      id: 'dcred-1',
      principal_amount: 350000,
      amount_paid: 150000,
      balance_due: 200000,
      due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString().split('T')[0], // 15 days overdue
      status: 'active',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
      customer: {
        full_name: 'Juma Hamisi',
        phone: '+255712345678'
      }
    },
    {
      id: 'dcred-2',
      principal_amount: 180000,
      amount_paid: 180000,
      balance_due: 0,
      due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString().split('T')[0],
      status: 'paid',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
      customer: {
        full_name: 'Neema Joseph',
        phone: '+255788765432'
      }
    },
    {
      id: 'dcred-3',
      principal_amount: 500000,
      amount_paid: 100000,
      balance_due: 400000,
      due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 35).toISOString().split('T')[0], // 35 days overdue
      status: 'active',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
      customer: {
        full_name: 'Daudi Salim',
        phone: '+255655998877'
      }
    },
    {
      id: 'dcred-4',
      principal_amount: 120000,
      amount_paid: 0,
      balance_due: 120000,
      due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString().split('T')[0], // 10 days in future
      status: 'active',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      customer: {
        full_name: 'Asha Bakari',
        phone: '+255773112233'
      }
    }
  ], [])

  const DEMO_REPAYMENTS = useMemo(() => [
    {
      id: 'drepay-1',
      credit_account_id: 'dcred-1',
      amount: 150000,
      notes: 'Paid via M-Pesa',
      paid_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
      credit_account: {
        customer: { full_name: 'Juma Hamisi' }
      }
    },
    {
      id: 'drepay-2',
      credit_account_id: 'dcred-2',
      amount: 180000,
      notes: 'Cash payment complete',
      paid_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      credit_account: {
        customer: { full_name: 'Neema Joseph' }
      }
    },
    {
      id: 'drepay-3',
      credit_account_id: 'dcred-3',
      amount: 100000,
      notes: 'Tigo Pesa transfer',
      paid_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
      credit_account: {
        customer: { full_name: 'Daudi Salim' }
      }
    }
  ], [])

  const accounts = isDemoMode ? DEMO_ACCOUNTS : initialAccounts
  const repayments = isDemoMode ? DEMO_REPAYMENTS : initialRepayments

  // Format Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  // Derived Account Statuses and Risk calculations
  const enhancedAccounts = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return accounts.map(account => {
      const balanceDue = Number(account.balance_due || 0)
      let daysOverdue = 0
      let computedStatus = account.status

      if (balanceDue > 0 && account.due_date) {
        const due = new Date(account.due_date)
        if (due < today) {
          daysOverdue = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
          computedStatus = 'overdue'
        } else {
          computedStatus = 'active'
        }
      } else if (balanceDue === 0) {
        computedStatus = 'paid'
      }

      const riskLevel = determineCustomerCreditRisk(balanceDue, daysOverdue)

      return {
        ...account,
        status: computedStatus,
        daysOverdue,
        riskLevel
      }
    })
  }, [accounts])

  // KPI Calculations using centralized domain rules
  const kpis = useMemo(() => {
    const totalOutstanding = calculateOutstandingCredit(enhancedAccounts.map(a => ({
      status: a.status === 'paid' ? 'paid' : 'active',
      balance_due: a.balance_due
    })))

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const overdueAccounts = enhancedAccounts.filter(a => a.status === 'overdue')
    const overdueValue = overdueAccounts.reduce((sum, a) => sum + Number(a.balance_due), 0)

    // Credit aging bins
    const age0to30 = enhancedAccounts
      .filter(a => a.status === 'overdue' && a.daysOverdue <= 30)
      .reduce((sum, a) => sum + Number(a.balance_due), 0)

    const age31to60 = enhancedAccounts
      .filter(a => a.status === 'overdue' && a.daysOverdue > 30 && a.daysOverdue <= 60)
      .reduce((sum, a) => sum + Number(a.balance_due), 0)

    const age61Plus = enhancedAccounts
      .filter(a => a.status === 'overdue' && a.daysOverdue > 60)
      .reduce((sum, a) => sum + Number(a.balance_due), 0)

    return {
      totalOutstanding,
      overdueCount: overdueAccounts.length,
      overdueValue,
      age0to30,
      age31to60,
      age61Plus
    }
  }, [enhancedAccounts])

  // Filter Accounts list
  const filteredAccounts = useMemo(() => {
    return enhancedAccounts.filter(account => {
      // Tab filter
      if (selectedStatusTab === 'active' && account.status !== 'active') return false
      if (selectedStatusTab === 'overdue' && account.status !== 'overdue') return false
      if (selectedStatusTab === 'paid' && account.status !== 'paid') return false

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const name = account.customer?.full_name?.toLowerCase() || ''
        const phone = account.customer?.phone || ''
        return name.includes(query) || phone.includes(query)
      }

      return true
    })
  }, [enhancedAccounts, selectedStatusTab, searchQuery])

  // Selected Account Repayments
  const selectedAccountRepayments = useMemo(() => {
    if (!selectedAccount) return []
    return repayments.filter(r => r.credit_account_id === selectedAccount.id)
  }, [repayments, selectedAccount])

  // WhatsApp Nudge Trigger
  const handleWhatsAppNudge = (account: any) => {
    const phone = account.customer?.phone || ''
    const rawPhone = phone.replace(/[^0-9]/g, '')
    // Ensure Tanzanian format
    const formattedPhone = rawPhone.startsWith('0') 
      ? '255' + rawPhone.slice(1) 
      : rawPhone.startsWith('+') 
      ? rawPhone.slice(1) 
      : rawPhone

    const formattedDate = account.due_date ? new Date(account.due_date).toLocaleDateString('en-GB') : 'N/A'
    const template = `Habari ${account.customer?.full_name}, hapa ni NEXPOS. Tunakukumbusha kulipia salio lako la mkopo la TZS ${new Intl.NumberFormat('en-TZ').format(account.balance_due)} lililotakiwa kulipwa kufikia tarehe ${formattedDate}. Tafadhali fanya malipo kupitia namba zetu za malipo au fika dukani. Asante!`
    
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(template)}`, '_blank')
  }

  // Handle Repayment Logging (Offline-first safe)
  const handleLogRepayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(repaymentAmount)
    if (!selectedAccount || amount <= 0 || amount > selectedAccount.balance_due) {
      return alert('Tafadhali weka kiasi sahihi cha malipo (kisichozidi salio linalodaiwa).')
    }

    setIsSubmitting(true)
    try {
      const payload = {
        credit_account_id: selectedAccount.id,
        branch_id: branchId,
        amount,
        payment_method: paymentMethod,
        reference_code: referenceCode,
        notes: repaymentNotes || 'Repayment logged from Ledger'
      }

      // Add to local sync engine queue
      addToSyncQueue('repayment', payload)

      alert(
        isOnline
          ? 'Malipo yamerekodiwa kikamilifu!'
          : 'Njia ya Nje ya Mtandao: Malipo yamehifadhiwa kwenye foleni. Yatasawazishwa kiotomatiki mtandao ukipatikana.'
      )

      // Optimistic locally updated state
      selectedAccount.balance_due = Math.max(0, Number(selectedAccount.balance_due) - amount)
      selectedAccount.amount_paid = Number(selectedAccount.amount_paid) + amount
      if (selectedAccount.balance_due === 0) {
        selectedAccount.status = 'paid'
      }

      setRepaymentAmount('')
      setReferenceCode('')
      setRepaymentNotes('')
      setIsRepayOpen(false)
    } catch (e) {
      console.error(e)
      alert('Imeshindwa kurekodi malipo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6 pb-12 flex flex-col gap-6 font-ui">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-nx-cyan/10 border border-nx-cyan/20 rounded-nx-card p-4 flex items-start gap-3 select-none">
          <Info className="w-5 h-5 text-nx-cyan shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[13px] font-bold text-nx-text">Demo Ledger Mode Active</h4>
            <p className="text-[12px] text-nx-text-sec leading-relaxed">
              No customer credit logs exist in the live database. NEXPOS is displaying mock debt accounts for evaluation. Checkouts under partial payments automatically populate this screen.
            </p>
          </div>
        </div>
      )}

      {/* Header Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 shrink-0">
        <div>
          <h1 className="text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Credit Ledger & Collections
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Track customer outstanding balances, credit aging bins, and log repayments offline-safely
          </p>
        </div>
      </div>

      {/* Zone 1 — Outstanding Balances & Aging Bins */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-[14px] shrink-0">
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider">Total Outstanding</span>
          <h3 className="font-data text-[20px] font-bold text-nx-text mt-2">
            {formatCurrency(kpis.totalOutstanding)}
          </h3>
          <span className="text-[10px] text-nx-text-muted mt-1">Across all accounts</span>
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-destructive uppercase tracking-wider">Overdue Balances</span>
          <h3 className="font-data text-[20px] font-bold text-destructive mt-2">
            {formatCurrency(kpis.overdueValue)}
          </h3>
          <span className="text-[10px] text-destructive/80 mt-1">{kpis.overdueCount} accounts past due</span>
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-nx-gold uppercase tracking-wider">0 - 30 Days Late</span>
          <h3 className="font-data text-[18px] font-bold text-nx-text mt-2">
            {formatCurrency(kpis.age0to30)}
          </h3>
          <span className="text-[10px] text-nx-text-muted mt-1">Minor risk</span>
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-orange-500 uppercase tracking-wider">31 - 60 Days Late</span>
          <h3 className="font-data text-[18px] font-bold text-nx-text mt-2">
            {formatCurrency(kpis.age31to60)}
          </h3>
          <span className="text-[10px] text-nx-text-muted mt-1">High monitoring</span>
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">61+ Days Late</span>
          <h3 className="font-data text-[18px] font-bold text-red-600 mt-2">
            {formatCurrency(kpis.age61Plus)}
          </h3>
          <span className="text-[10px] text-red-600/80 mt-1">Critical recovery</span>
        </div>
      </div>

      {/* Main Ledger Area */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start flex-grow">
        
        {/* Left Side: Accounts Table */}
        <div className="space-y-4">
          {/* Status Tabs and Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-nx-surface border border-nx-border p-3 rounded-nx-card select-none">
            <div className="flex gap-1 overflow-x-auto">
              {(['all', 'active', 'overdue', 'paid'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedStatusTab(tab)}
                  className={`px-3 py-1.5 rounded-nx-btn text-[12px] font-medium uppercase tracking-wider transition-colors shrink-0 ${
                    selectedStatusTab === tab
                      ? 'bg-nx-cyan text-white'
                      : 'hover:bg-nx-hover text-nx-text-sec'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            <div className="relative w-full sm:w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer..."
                className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[12px] pl-8 pr-3 py-1.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
              />
            </div>
          </div>

          {/* Accounts List Container with horizontal drag scroll */}
          <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
            <div className="overflow-x-auto cursor-grab active:cursor-grabbing">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-nx-elevated border-b border-nx-border text-[11px] font-bold text-nx-text-sec uppercase tracking-wider">
                    <th className="py-3 px-4 sticky left-0 bg-nx-elevated z-10">Customer Name</th>
                    <th className="py-3 px-4">Contact Phone</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Risk Level</th>
                    <th className="py-3 px-4 text-right">Principal</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                    <th className="py-3 px-4 text-center">Nudge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nx-border/50 text-[13px]">
                  {filteredAccounts.map(account => {
                    const isSelected = selectedAccount?.id === account.id
                    return (
                      <tr 
                        key={account.id}
                        onClick={() => setSelectedAccount(account)}
                        className={`hover:bg-nx-hover/20 cursor-pointer transition-colors ${
                          isSelected ? 'bg-nx-cyan/5 border-l-2 border-l-nx-cyan' : ''
                        }`}
                      >
                        {/* Sticky First Column */}
                        <td className={`py-3.5 px-4 font-semibold text-nx-text sticky left-0 z-10 ${
                          isSelected ? 'bg-nx-cyan-[5%] md:bg-white' : 'bg-white'
                        }`}>
                          {account.customer?.full_name}
                        </td>
                        <td className="py-3.5 px-4 text-nx-text-sec font-data">
                          {account.customer?.phone}
                        </td>
                        <td className="py-3.5 px-4 text-nx-text-sec font-data">
                          {account.due_date ? new Date(account.due_date).toLocaleDateString() : '-'}
                          {account.daysOverdue > 0 && (
                            <span className="ml-2 text-[10px] text-destructive font-bold">
                              ({account.daysOverdue}D late)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            account.riskLevel === 'critical' ? 'bg-red-500/10 text-red-600' :
                            account.riskLevel === 'high_risk' ? 'bg-orange-500/10 text-orange-600' :
                            account.riskLevel === 'watch' ? 'bg-nx-gold/10 text-nx-gold' :
                            'bg-nx-cyan/10 text-nx-cyan'
                          }`}>
                            {account.riskLevel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-data text-nx-text-sec">
                          {formatCurrency(account.principal_amount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-data text-green-600">
                          {formatCurrency(account.amount_paid)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-data font-bold text-nx-text">
                          {formatCurrency(account.balance_due)}
                        </td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {account.balance_due > 0 ? (
                            <button
                              onClick={() => handleWhatsAppNudge(account)}
                              className="p-1 hover:bg-nx-hover text-green-600 rounded transition-colors"
                              title="WhatsApp Nudge"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-green-600 flex justify-center"><Check className="w-4 h-4" /></span>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {filteredAccounts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-nx-text-muted">
                        No credit accounts found matching filter criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Account Details & Timeline */}
        {selectedAccount ? (
          <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-6 select-none sticky top-4 shrink-0">
            <div className="flex items-center justify-between border-b border-nx-border pb-4">
              <div>
                <h3 className="font-bold text-[14px] text-nx-text line-clamp-1">
                  {selectedAccount.customer?.full_name}
                </h3>
                <span className="text-[11px] text-nx-text-sec font-data">
                  {selectedAccount.customer?.phone}
                </span>
              </div>
              {selectedAccount.balance_due > 0 && (
                <button
                  onClick={() => setIsRepayOpen(true)}
                  className="bg-nx-cyan hover:bg-nx-cyan/90 text-white px-3 py-1.5 rounded-nx-btn text-[11px] font-semibold flex items-center gap-1.5 transition-transform active:scale-95"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Log Repayment
                </button>
              )}
            </div>

            {/* Balances detail */}
            <div className="grid grid-cols-2 gap-4 text-[12px] bg-nx-elevated/40 p-3 rounded-nx-card border border-nx-border/50">
              <div>
                <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Remaining Balance</span>
                <p className="font-data font-bold text-[16px] text-nx-text mt-0.5">
                  {formatCurrency(selectedAccount.balance_due)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Total Repayed</span>
                <p className="font-data font-bold text-[16px] text-green-600 mt-0.5">
                  {formatCurrency(selectedAccount.amount_paid)}
                </p>
              </div>
            </div>

            {/* Repayments History timeline */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Repayments History</h4>
              <div className="border border-nx-border rounded-nx-card overflow-hidden text-[12px] max-h-[220px] overflow-y-auto">
                <div className="bg-nx-elevated px-4 py-2 border-b border-nx-border flex justify-between font-semibold text-nx-text-sec text-[10px]">
                  <span>Paid At</span>
                  <span>Amount</span>
                </div>
                <div className="divide-y divide-nx-border/50">
                  {selectedAccountRepayments.length > 0 ? (
                    selectedAccountRepayments.map((rep: any) => (
                      <div key={rep.id} className="px-4 py-2.5 flex justify-between items-center hover:bg-nx-hover/10">
                        <div className="text-[11px]">
                          <p className="text-nx-text font-data font-semibold">{formatCurrency(rep.amount)}</p>
                          <span className="text-[10px] text-nx-text-muted font-data">
                            {new Date(rep.paid_at).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="text-[11px] text-nx-text-sec max-w-[150px] truncate" title={rep.notes}>
                          {rep.notes}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-nx-text-muted">
                      No repayments recorded yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-nx-surface border border-nx-border rounded-nx-card p-8 text-center text-nx-text-muted text-[13px]">
            Select a customer from the ledger to view repayment timeline and process payments.
          </div>
        )}
      </div>

      {/* Log Repayment Modal */}
      {isRepayOpen && selectedAccount && (
        <>
          <div 
            onClick={() => setIsRepayOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-50 transition-opacity"
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-[420px] bg-nx-surface border-l border-nx-border shadow-[0_0_24px_rgba(0,0,0,0.15)] z-50 flex flex-col transform transition-transform duration-300 ease-out translate-x-0 font-ui select-none">
            <div className="p-5 border-b border-nx-border flex items-center justify-between bg-nx-elevated/40">
              <div>
                <h3 className="font-semibold text-[15px] text-nx-text">Log Customer Repayment</h3>
                <span className="text-[11px] text-nx-text-sec">{selectedAccount.customer?.full_name}</span>
              </div>
              <button onClick={() => setIsRepayOpen(false)} className="p-1 hover:bg-nx-hover rounded">
                <svg className="w-5 h-5 text-nx-text-sec" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleLogRepayment} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-nx-cyan/5 border border-nx-cyan/20 p-4 rounded-nx-card space-y-1">
                <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Remaining Balance</span>
                <h4 className="font-data font-bold text-[20px] text-nx-text">
                  {formatCurrency(selectedAccount.balance_due)}
                </h4>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Payment Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-data font-bold text-nx-text-sec text-[13px]">TZS</span>
                  <input
                    type="number"
                    required
                    min={1}
                    max={selectedAccount.balance_due}
                    value={repaymentAmount}
                    onChange={(e) => setRepaymentAmount(e.target.value)}
                    placeholder="Enter amount paid"
                    className="w-full bg-nx-elevated border border-nx-border text-nx-text font-data text-[13px] pl-12 pr-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                >
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money (M-Pesa/Tigo Pesa/Airtel Money)</option>
                  <option value="card">Card Payment</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Reference Code / Transaction ID</label>
                <input
                  type="text"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="e.g. PP23456789 (optional)"
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Repayment Notes</label>
                <textarea
                  value={repaymentNotes}
                  onChange={(e) => setRepaymentNotes(e.target.value)}
                  placeholder="Additional receipt notes..."
                  rows={2}
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] p-3 rounded-nx-btn focus:outline-none focus:border-nx-cyan resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-nx-cyan hover:bg-nx-cyan/90 text-white font-semibold text-[13px] py-3 rounded-nx-btn flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-sm mt-6"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Log Repayment</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
