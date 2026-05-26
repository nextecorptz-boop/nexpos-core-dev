'use client'

import React from 'react'
import { Phone, Mail, User, ShieldCheck, TrendingUp, ShoppingBag, Plus } from 'lucide-react'
import { determineSupplierRisk } from '@/lib/domain/risk'

interface SupplierCardProps {
  supplier: any
  onSelect: (supplier: any) => void
  onInitiatePO?: (supplierId: string) => void
  isSelected?: boolean
}

export function SupplierCard({ supplier, onSelect, onInitiatePO, isSelected = false }: SupplierCardProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  // Calculate reliability badge using Risk utilities
  const reliability = determineSupplierRisk(
    supplier.fulfilled_orders_count || 10,
    supplier.late_orders_count || 0
  )

  const borderClass = isSelected 
    ? 'border-nx-cyan ring-1 ring-nx-cyan/20 bg-nx-cyan/5' 
    : 'border-nx-border bg-nx-surface hover:border-nx-cyan/30 hover:shadow-sm'

  return (
    <div 
      onClick={() => onSelect(supplier)}
      className={`border rounded-nx-card p-5 transition-all duration-200 cursor-pointer flex flex-col gap-4 select-none ${borderClass}`}
    >
      {/* Supplier Profile Section */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Circular Initial Avatar */}
          <div className="w-11 h-11 rounded-full bg-nx-cyan/15 flex items-center justify-center shrink-0 text-nx-cyan text-[15px] font-bold">
            {supplier.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h4 className="font-bold text-[14px] text-nx-text line-clamp-1">{supplier.name}</h4>
            <p className="text-[11px] text-nx-text-sec flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3" /> {supplier.contact_person || 'No Contact Person'}
            </p>
          </div>
        </div>

        {/* Reliability Indicator */}
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider border ${
          reliability === 'healthy' ? 'bg-nx-green/10 text-nx-green border-nx-green/20' :
          reliability === 'watch' ? 'bg-nx-orange/10 text-nx-orange border-nx-orange/20' :
          'bg-nx-red/10 text-nx-red border-nx-red/20'
        }`}>
          {reliability === 'healthy' ? 'Reliable' : reliability === 'watch' ? 'Watch' : 'At Risk'}
        </span>
      </div>

      {/* Supplier Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 py-2 border-y border-nx-border/50 text-[12px] bg-nx-elevated/20 px-2 rounded-nx-xs">
        <div>
          <span className="text-nx-text-muted text-[10px] uppercase font-medium">Total Spend</span>
          <p className="font-data text-[12px] font-bold text-nx-text mt-0.5">
            {formatCurrency(supplier.total_spend || 0)}
          </p>
        </div>
        <div>
          <span className="text-nx-text-muted text-[10px] uppercase font-medium">Outstanding Debt</span>
          <p className={`font-data text-[12px] font-bold mt-0.5 ${Number(supplier.balance_due || 0) > 0 ? 'text-nx-orange' : 'text-nx-text'}`}>
            {formatCurrency(supplier.balance_due || 0)}
          </p>
        </div>
      </div>

      {/* Supplier Contact list */}
      <div className="space-y-1.5 text-[12px] text-nx-text-sec">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-nx-text-muted" />
          <span className="font-data">{supplier.phone}</span>
        </div>
        {supplier.email && (
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-nx-text-muted" />
            <span className="truncate">{supplier.email}</span>
          </div>
        )}
      </div>

      {/* Quick CTAs */}
      {onInitiatePO && (
        <div className="mt-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onInitiatePO(supplier.id)
            }}
            className="w-full bg-nx-elevated hover:bg-nx-cyan hover:text-white border border-nx-border hover:border-nx-cyan px-3 py-2 rounded-nx-btn text-[12px] font-semibold text-nx-text-sec transition-all duration-150 flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Purchase Order</span>
          </button>
        </div>
      )}
    </div>
  )
}
