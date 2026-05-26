'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Download, Search, AlertCircle, Info } from 'lucide-react'
import { OrdersTable } from '@/components/workspace/sales/orders-table'
import { getOperationalStatus } from '@/lib/utils/sales'

// High-quality mock data for demo mode when tenant has zero sales
const DEMO_SALES = [
  {
    id: 'demo-1',
    receipt_number: 'NX-260524-001',
    sale_date: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12 mins ago
    total_amount: 145000,
    subtotal: 145000,
    discount_amount: 0,
    amount_paid: 145000,
    balance_due: 0,
    status: 'completed',
    customer: { full_name: 'Juma Shariff', phone: '+255 754 112 233', notes: 'Regular buyer from Zanzibar' },
    cashier: { full_name: 'Fatma Kassim', role: 'manager' },
    payments: [{ payment_method: 'mobile_money', amount: 145000, reference_code: 'MP-89102' }],
    sale_items: [
      {
        id: 'ditem-1',
        quantity: 1,
        unit_price: 95000,
        subtotal: 95000,
        variant: { size: '43', color: 'Brown', family: { name: 'Safari Leather Boots' } }
      },
      {
        id: 'ditem-2',
        quantity: 1,
        unit_price: 50000,
        subtotal: 50000,
        variant: { size: '41', color: 'White', family: { name: 'Casual Sneaker' } }
      }
    ]
  },
  {
    id: 'demo-2',
    receipt_number: 'NX-260524-002',
    sale_date: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    total_amount: 85000,
    subtotal: 85000,
    discount_amount: 0,
    amount_paid: 30000,
    balance_due: 55000,
    status: 'partial',
    customer: { full_name: 'Neema Mwita', phone: '+255 682 990 887', notes: 'Deposit paid' },
    cashier: { full_name: 'Ally Salehe', role: 'cashier' },
    payments: [{ payment_method: 'cash', amount: 30000, reference_code: '' }],
    sale_items: [
      {
        id: 'ditem-3',
        quantity: 1,
        unit_price: 85000,
        subtotal: 85000,
        variant: { size: '39', color: 'Black', family: { name: 'Formal Loafers' } }
      }
    ]
  },
  {
    id: 'demo-3',
    receipt_number: 'NX-260524-003',
    sale_date: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
    total_amount: 110000,
    subtotal: 110000,
    discount_amount: 10000,
    amount_paid: 0,
    balance_due: 110000,
    status: 'partial',
    customer: { full_name: 'David Minja', phone: '+255 712 443 554', notes: 'Requires invoice settlement' },
    cashier: { full_name: 'Ally Salehe', role: 'cashier' },
    payments: [],
    sale_items: [
      {
        id: 'ditem-4',
        quantity: 2,
        unit_price: 55000,
        subtotal: 110000,
        variant: { size: '44', color: 'Navy', family: { name: 'Running Trainer' } }
      }
    ]
  },
  {
    id: 'demo-4',
    receipt_number: 'NX-260524-004',
    sale_date: new Date(Date.now() - 1000 * 60 * 360).toISOString(), // 6 hours ago
    total_amount: 65000,
    subtotal: 65000,
    discount_amount: 0,
    amount_paid: 0,
    balance_due: 0,
    status: 'cancelled',
    customer: null,
    cashier: { full_name: 'Ally Salehe', role: 'cashier' },
    payments: [],
    sale_items: [
      {
        id: 'ditem-5',
        quantity: 1,
        unit_price: 65000,
        subtotal: 65000,
        variant: { size: '38', color: 'Red', family: { name: 'Canvas Slip-on' } }
      }
    ]
  }
]

interface OrdersContainerProps {
  initialSales: any[]
  userRole: string
}

export function OrdersContainer({ initialSales, userRole }: OrdersContainerProps) {
  const isDemoMode = initialSales.length === 0
  const salesDataset = isDemoMode ? DEMO_SALES : initialSales

  // State Management
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // Persist and load active status tab
  useEffect(() => {
    const savedTab = localStorage.getItem('nx-orders-tab')
    if (savedTab) {
      setActiveTab(savedTab)
    }
  }, [])

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    setCurrentPage(1)
    localStorage.setItem('nx-orders-tab', tabId)
  }

  // Live count computations for pipeline badges
  const counts = useMemo(() => {
    const stats = { all: salesDataset.length, pending: 0, processing: 0, completed: 0, cancelled: 0 }
    salesDataset.forEach(s => {
      const opStatus = getOperationalStatus(s)
      if (opStatus in stats) {
        stats[opStatus as keyof typeof stats] += 1
      }
    })
    return stats
  }, [salesDataset])

  // Filtered dataset
  const filteredSales = useMemo(() => {
    return salesDataset.filter(sale => {
      // 1. Status Filter
      const opStatus = getOperationalStatus(sale)
      if (activeTab !== 'all' && opStatus !== activeTab) return false

      // 2. Search Filter (receipt #, customer name, cashier name)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchReceipt = sale.receipt_number.toLowerCase().includes(query)
        const matchCustomer = sale.customer?.full_name?.toLowerCase().includes(query) || false
        const matchCashier = sale.cashier?.full_name?.toLowerCase().includes(query) || false
        return matchReceipt || matchCustomer || matchCashier
      }

      return true
    })
  }, [salesDataset, activeTab, searchQuery])

  // Paginated dataset
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredSales.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredSales, currentPage])

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage) || 1

  // Raw CSV Export (Clean, accounting-ready data without localization)
  const handleExportCSV = () => {
    if (isDemoMode) {
      alert("CSV Export Disabled: Real database has no transactions. Complete checkouts in POS mode to download data.")
      return
    }

    const headers = ['receipt_number', 'customer_name', 'cashier_name', 'status', 'payment_method', 'sale_date', 'total_amount', 'amount_paid', 'balance_due']
    
    const rows = filteredSales.map(sale => {
      const customerName = sale.customer?.full_name || 'Walk-in'
      const cashierName = sale.cashier?.full_name || 'System'
      const status = getOperationalStatus(sale)
      const paymentMethod = sale.payments?.[0]?.payment_method || 'N/A'
      const saleDate = new Date(sale.sale_date).toISOString().split('T')[0]
      
      return [
        sale.receipt_number,
        customerName,
        cashierName,
        status,
        paymentMethod,
        saleDate,
        Number(sale.total_amount || 0),
        Number(sale.amount_paid || 0),
        Number(sale.balance_due || 0)
      ]
    })
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n')
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `orders_export_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
              No transactions exist in the database. NEXPOS is displaying mock operational transactions for showcase purposes. Go to the <Link href="/app/pos" className="text-nx-cyan hover:underline font-semibold">Point of Sale</Link> terminal and process a transaction to see actual live metrics.
            </p>
          </div>
        </div>
      )}

      {/* Zone 1 — Header Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 shrink-0">
        <div>
          <h1 className="text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Orders
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Instant Search */}
          <div className="relative min-w-[200px] md:min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search receipt, customer, cashier..."
              className="w-full bg-nx-surface border border-nx-border text-nx-text text-[13px] pl-9 pr-4 py-2 rounded-nx-btn focus:outline-none focus:border-nx-cyan transition-colors"
            />
          </div>

          {/* CTAs */}
          <button
            onClick={handleExportCSV}
            disabled={isDemoMode}
            className="bg-nx-surface hover:bg-nx-hover border border-nx-border text-nx-text-sec hover:text-nx-text px-4 py-2 rounded-nx-btn flex items-center text-[13px] font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          
          <Link 
            href="/app/pos" 
            className="bg-nx-cyan hover:bg-nx-cyan/90 text-white px-4 py-2 rounded-nx-btn flex items-center text-[13px] font-medium transition-all duration-150 active:scale-[0.97]"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Sale
          </Link>
        </div>
      </div>

      {/* Zone 2 — Pipeline Status Tabs */}
      <div className="overflow-x-auto no-scrollbar border-b border-nx-border pb-1 shrink-0">
        <div className="flex gap-1 min-w-max">
          {[
            { id: 'all', label: 'All Transactions' },
            { id: 'pending', label: 'Pending' },
            { id: 'processing', label: 'Processing' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' }
          ].map(tab => {
            const isActive = activeTab === tab.id
            const count = counts[tab.id as keyof typeof counts] || 0
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-[5px]
                  ${isActive 
                    ? 'border-nx-cyan text-nx-cyan font-bold' 
                    : 'border-transparent text-nx-text-sec hover:text-nx-text'
                  }
                `}
              >
                <span>{tab.label}</span>
                <span className={`
                  px-1.5 py-0.5 rounded-full text-[10px] font-bold select-none
                  ${isActive 
                    ? 'bg-nx-cyan/15 text-nx-cyan' 
                    : 'bg-nx-elevated text-nx-text-sec border border-nx-border/50'
                  }
                `}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Zone 3 — Orders Table */}
      <div className="flex-grow min-h-0">
        <OrdersTable
          orders={paginatedSales}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  )
}
