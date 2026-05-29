'use client'

import React, { useState, useMemo } from 'react'
import { Info, AlertCircle, TrendingUp, Calendar, Plus, Tag, FileText, Loader2, DollarSign, Search, Check } from 'lucide-react'
import { addToSyncQueue } from '@/lib/sync/sync-engine'
import { useSyncStatus } from '@/lib/sync/use-sync-status'
import { calculateExpenseRatio } from '@/lib/domain/metrics'
import { detectExpenseSpike } from '@/lib/domain/risk'

interface ExpensesContainerProps {
  initialExpenses: any[]
  initialCategories: any[]
  initialSales: any[]
  branchId: string
}

export function ExpensesContainer({
  initialExpenses,
  initialCategories,
  initialSales,
  branchId
}: ExpensesContainerProps) {
  const isDemoMode = initialExpenses.length === 0
  const { isOnline } = useSyncStatus()

  // State Management
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')
  const [isLogOpen, setIsLogOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Demo Fallback Data
  const DEMO_CATEGORIES = useMemo(() => [
    { id: 'dcat-1', name: 'Rent (Kodi ya Pango)' },
    { id: 'dcat-2', name: 'Staff Wages (Mishahara)' },
    { id: 'dcat-3', name: 'Utilities (Maji/Umeme)' },
    { id: 'dcat-4', name: 'Transport & Fuel' },
    { id: 'dcat-5', name: 'Other Expenses' }
  ], [])

  const DEMO_EXPENSES = useMemo(() => [
    {
      id: 'dexp-1',
      amount: 450000,
      description: 'May Shop Rental Payment',
      expense_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString().split('T')[0],
      category_id: 'dcat-1',
      category: { name: 'Rent (Kodi ya Pango)' }
    },
    {
      id: 'dexp-2',
      amount: 250000,
      description: 'Salary advance for assistant manager',
      expense_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString().split('T')[0],
      category_id: 'dcat-2',
      category: { name: 'Staff Wages (Mishahara)' }
    },
    {
      id: 'dexp-3',
      amount: 65000,
      description: 'Dar Water bill payment',
      expense_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString().split('T')[0],
      category_id: 'dcat-3',
      category: { name: 'Utilities (Maji/Umeme)' }
    },
    {
      id: 'dexp-4',
      amount: 45000,
      description: 'Motorcycle delivery dispatch fees',
      expense_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString().split('T')[0],
      category_id: 'dcat-4',
      category: { name: 'Transport & Fuel' }
    }
  ], [])

  const DEMO_SALES = useMemo(() => [
    { id: 's-1', total_amount: 1500000, status: 'completed' },
    { id: 's-2', total_amount: 800000, status: 'completed' },
    { id: 's-3', total_amount: 2000000, status: 'completed' }
  ], [])

  const categories = isDemoMode ? DEMO_CATEGORIES : initialCategories
  const expenses = isDemoMode ? DEMO_EXPENSES : initialExpenses
  const sales = isDemoMode ? DEMO_SALES : initialSales

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  // Filter expenses list
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Category Filter
      if (selectedCategoryFilter !== 'all' && exp.category_id !== selectedCategoryFilter) return false

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        return exp.description.toLowerCase().includes(query) || 
               (exp.category?.name && exp.category.name.toLowerCase().includes(query))
      }

      return true
    })
  }, [expenses, selectedCategoryFilter, searchQuery])

  // Financial Domain Metric Calculations
  const metrics = useMemo(() => {
    const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    
    // Daily burn rate (assuming 30 days coverage)
    const dailyBurn = totalAmount / 30

    // Centralized expense ratio
    const expenseRatio = calculateExpenseRatio(sales, expenses)

    // Compute category breakdown totals
    const categoryBreakdown = categories.map(cat => {
      const catExpenses = expenses.filter(e => e.category_id === cat.id)
      const amount = catExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
      return {
        id: cat.id,
        name: cat.name,
        amount
      }
    }).sort((a, b) => b.amount - a.amount)

    // Detect if recent expense was a spike (compared to monthly avg)
    const monthlyAverage = totalAmount / (expenses.length || 1)
    const recentExpenseSpike = expenses.length > 0 && detectExpenseSpike(Number(expenses[0].amount), monthlyAverage)

    return {
      totalAmount,
      dailyBurn,
      expenseRatio,
      categoryBreakdown,
      recentExpenseSpike
    }
  }, [expenses, categories, sales])

  // Generate SVG chart data
  const chartData = useMemo(() => {
    // Group expenses by date (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return d.toISOString().split('T')[0]
    }).reverse()

    const dailyTotals = last7Days.map(date => {
      const dayExpenses = expenses.filter(e => e.expense_date === date)
      const total = dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
      return {
        date: new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        total
      }
    })

    const maxVal = Math.max(...dailyTotals.map(t => t.total), 100000)

    return {
      points: dailyTotals,
      maxVal
    }
  }, [expenses])

  // Handle logging new expense (offline-safe)
  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(amount)
    if (amt <= 0 || !categoryId || !description.trim()) {
      return alert('Tafadhali jaza kiasi, kitengo (kategoria), na maelezo ya matumizi.')
    }

    setIsSubmitting(true)
    try {
      const payload = {
        branch_id: branchId,
        category_id: categoryId,
        amount: amt,
        description,
        expense_date: expenseDate
      }

      // Add to local storage sync engine
      addToSyncQueue('expense', payload)

      alert(
        isOnline
          ? 'Matumizi yamehifadhiwa kikamilifu!'
          : 'Njia ya Nje ya Mtandao: Matumizi yamehifadhiwa kwenye foleni. Yatasawazishwa kiotomatiki mtandao ukipatikana.'
      )

      // Optimistically push to local visual list
      const selectedCat = categories.find(c => c.id === categoryId)
      expenses.unshift({
        id: `local-${Date.now()}`,
        amount: amt,
        description,
        expense_date: expenseDate,
        category_id: categoryId,
        category: { name: selectedCat?.name || 'Kategoria Fallback' }
      })

      setAmount('')
      setDescription('')
      setCategoryId('')
      setIsLogOpen(false)
    } catch (e) {
      console.error(e)
      alert('Imeshindwa kurekodi matumizi.')
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
            <h4 className="text-[13px] font-bold text-nx-text">Demo Expense Tracker Active</h4>
            <p className="text-[12px] text-nx-text-sec leading-relaxed">
              No business expenses recorded in the database. NEXPOS is presenting pre-populated operational outlays for showcase. Click "Record Expense" to register matumizi offline-safely.
            </p>
          </div>
        </div>
      )}

      {/* Header Strip */}
      <div className="flex items-center justify-between pt-4 shrink-0">
        <div>
          <h1 className="text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Expense Logging & Burn Rate
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Track business operating costs, category analytics, and cashier cash outflows
          </p>
        </div>

        <button
          onClick={() => setIsLogOpen(true)}
          className="bg-nx-cyan hover:bg-nx-cyan/90 text-white px-4 py-2 rounded-nx-btn flex items-center text-[13px] font-medium transition-all duration-150 active:scale-[0.97] select-none"
        >
          <Plus className="w-4 h-4 mr-2" />
          Record Expense
        </button>
      </div>

      {/* Zone 1 — Operational Burn Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] shrink-0">
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex flex-col justify-between relative overflow-hidden">
          <span className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider">Total Expenses (30 Days)</span>
          <h3 className="font-data text-[22px] font-bold text-nx-text mt-3">
            {formatCurrency(metrics.totalAmount)}
          </h3>
          <span className="text-[10px] text-nx-text-muted mt-1">Sum of logged expenses</span>
          {metrics.recentExpenseSpike && (
            <div className="absolute top-4 right-4 flex items-center gap-1 bg-nx-red/10 text-nx-red px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">
              <AlertCircle className="w-3.5 h-3.5" />
              Spike Flagged
            </div>
          )}
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider">Daily Burn Rate</span>
          <h3 className="font-data text-[22px] font-bold text-nx-text mt-3">
            {formatCurrency(metrics.dailyBurn)}
          </h3>
          <span className="text-[10px] text-nx-text-muted mt-1">Average spent per day</span>
        </div>

        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider">Expense-to-Revenue Ratio</span>
          <h3 className="font-data text-[22px] font-bold text-nx-text mt-3">
            {metrics.expenseRatio.toFixed(1)}%
          </h3>
          <span className="text-[10px] text-nx-text-muted mt-1">Of active revenues consumed</span>
        </div>
      </div>

      {/* Split view: Chart and Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: SVG Trend Chart */}
        <div className="lg:col-span-2 bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-nx-text">Last 7 Days Outflow Trend</h3>
            <span className="text-[11px] text-nx-text-sec font-data">JetBrains Mono Metrics</span>
          </div>

          {/* SVG Chart */}
          <div className="w-full h-[180px] relative select-none">
            <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
              <g className="opacity-10">
                <line x1="0" y1="30" x2="500" y2="30" stroke="#888" strokeWidth="0.5" strokeDasharray="3,3" />
                <line x1="0" y1="60" x2="500" y2="60" stroke="#888" strokeWidth="0.5" strokeDasharray="3,3" />
                <line x1="0" y1="90" x2="500" y2="90" stroke="#888" strokeWidth="0.5" strokeDasharray="3,3" />
              </g>

              {/* Area path */}
              <path
                d={`M 0 120 ${chartData.points.map((p, idx) => {
                  const x = (idx / 6) * 500
                  const y = 120 - (p.total / chartData.maxVal) * 100
                  return `L ${x} ${y}`
                }).join(' ')} L 500 120 Z`}
                fill="rgba(0, 168, 204, 0.05)"
              />

              {/* Line path */}
              <path
                d={chartData.points.map((p, idx) => {
                  const x = (idx / 6) * 500
                  const y = 120 - (p.total / chartData.maxVal) * 100
                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                }).join(' ')}
                fill="none"
                stroke="var(--nx-cyan, #00A8CC)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points dots */}
              {chartData.points.map((p, idx) => {
                const x = (idx / 6) * 500
                const y = 120 - (p.total / chartData.maxVal) * 100
                return (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r="4"
                    fill="#FFFFFF"
                    stroke="var(--nx-cyan, #00A8CC)"
                    strokeWidth="2"
                  />
                )
              })}
            </svg>
            
            {/* Axis labels */}
            <div className="flex justify-between text-[10px] text-nx-text-sec mt-2 font-data">
              {chartData.points.map((p, idx) => (
                <span key={idx}>{p.date}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Category Distribution */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-4">
          <h3 className="text-[14px] font-bold text-nx-text">Outlays by Category</h3>
          <div className="space-y-3">
            {metrics.categoryBreakdown.map(cat => {
              const pct = metrics.totalAmount > 0 ? (cat.amount / metrics.totalAmount) * 100 : 0
              return (
                <div key={cat.id} className="space-y-1 select-none">
                  <div className="flex justify-between text-[12px] font-medium">
                    <span className="text-nx-text truncate max-w-[160px]" title={cat.name}>{cat.name}</span>
                    <span className="font-data text-nx-text-sec">{formatCurrency(cat.amount)}</span>
                  </div>
                  {/* Progress Line */}
                  <div className="w-full bg-nx-elevated h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-nx-cyan h-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            
            {metrics.categoryBreakdown.length === 0 && (
              <p className="text-center py-6 text-nx-text-muted text-[12px]">No category summaries</p>
            )}
          </div>
        </div>
      </div>

      {/* Zone 3 — Expenses Table (Horizontal scroll, sticky column) */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden">
        <div className="p-4 border-b border-nx-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
          <h3 className="font-bold text-[14px] text-nx-text">Recent Outlays Register</h3>
          
          <div className="flex gap-2">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-nx-elevated border border-nx-border text-nx-text text-[12px] px-2.5 py-1.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search outlays..."
                className="bg-nx-elevated border border-nx-border text-nx-text text-[12px] pl-8 pr-3 py-1.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan w-[200px]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto cursor-grab active:cursor-grabbing">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-nx-elevated border-b border-nx-border text-[11px] font-bold text-nx-text-sec uppercase tracking-wider">
                <th className="py-3 px-4 sticky left-0 bg-nx-elevated z-10">Description</th>
                <th className="py-3 px-4">Expense Category</th>
                <th className="py-3 px-4">Expense Date</th>
                <th className="py-3 px-4 text-right">Amount Outflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-border/50 text-[13px]">
              {filteredExpenses.map(exp => (
                <tr key={exp.id} className="hover:bg-nx-hover/20 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-nx-text sticky left-0 bg-nx-surface z-10">
                    {exp.description}
                  </td>
                  <td className="py-3.5 px-4 text-nx-text-sec">
                    {exp.category?.name || 'Operational Costs'}
                  </td>
                  <td className="py-3.5 px-4 text-nx-text-sec font-data">
                    {new Date(exp.expense_date).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-data font-bold text-nx-red">
                    -{formatCurrency(exp.amount)}
                  </td>
                </tr>
              ))}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-nx-text-muted">
                    No matching outlays found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Side Drawer Modal */}
      {isLogOpen && (
        <>
          <div 
            onClick={() => setIsLogOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-50 transition-opacity"
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-[420px] bg-nx-surface border-l border-nx-border shadow-[0_0_24px_rgba(0,0,0,0.15)] z-50 flex flex-col transform transition-transform duration-300 ease-out translate-x-0 font-ui select-none">
            <div className="p-5 border-b border-nx-border flex items-center justify-between bg-nx-elevated/40">
              <h3 className="font-semibold text-[15px] text-nx-text">Record Expense Outflow</h3>
              <button onClick={() => setIsLogOpen(false)} className="p-1 hover:bg-nx-hover rounded">
                <svg className="w-5 h-5 text-nx-text-sec" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleLogExpense} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Outlay Description *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Electricity bill Dar Branch May"
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Expense Category *</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Amount Outflow *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-data font-bold text-nx-text-sec text-[13px]">TZS</span>
                  <input
                    type="number"
                    required
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount paid"
                    className="w-full bg-nx-elevated border border-nx-border text-nx-text font-data text-[13px] pl-12 pr-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Outlay Date *</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text font-data text-[13px] px-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
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
                    <span>Saving Outflow...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Log Outflow</span>
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
