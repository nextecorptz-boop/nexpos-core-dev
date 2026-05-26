'use client'

import React from 'react'
import { X, AlertTriangle, ArrowRight, Zap, Phone, Calendar, ShoppingCart } from 'lucide-react'
import { predictStockDepletion, calculateSuggestedReorder } from '@/lib/domain/forecast'

interface RestockPanelProps {
  item: any // Selected inventory item
  isOpen: boolean
  onClose: () => void
  onInitiatePO?: (supplierId: string, variantId: string, quantity: number) => void
}

export function RestockPanel({ item, isOpen, onClose, onInitiatePO }: RestockPanelProps) {
  if (!isOpen || !item) return null

  // Calculate metrics using Domain utilities
  const currentQty = Number(item.stock_left || 0)
  const threshold = Number(item.low_stock_threshold || 5)
  // Assume a default daily velocity of 0.8 if units_sold is not populated, to provide mock forecasts
  const dailyVelocity = item.units_sold > 0 ? (item.units_sold / 30) : 0.4
  
  const daysRemaining = predictStockDepletion(currentQty, dailyVelocity)
  const suggestedReorder = calculateSuggestedReorder(currentQty, dailyVelocity, 30, threshold)

  const isCritical = currentQty <= threshold

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  const handleCreatePO = () => {
    if (onInitiatePO && item.supplier_id) {
      onInitiatePO(item.supplier_id, item.id, suggestedReorder || 15)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-50 transition-opacity"
      />

      {/* Sliding Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[440px] bg-nx-surface border-l border-nx-border shadow-[0_0_24px_rgba(0,0,0,0.15)] z-50 flex flex-col transform transition-transform duration-300 ease-out translate-x-0 font-ui select-none">
        {/* Header */}
        <div className="p-5 border-b border-nx-border flex items-center justify-between bg-nx-elevated/40">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-nx-gold animate-pulse" />
            <h3 className="font-semibold text-[15px] text-nx-text">Restock Advisor</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-nx-hover border border-transparent hover:border-nx-border rounded-nx-xs text-nx-text-sec transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {/* Target Product Specs */}
          <div className="p-4 bg-nx-elevated border border-nx-border rounded-nx-card">
            <span className="text-[10px] bg-nx-cyan/10 text-nx-cyan px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              {item.category_name}
            </span>
            <h4 className="font-bold text-[15px] text-nx-text mt-2">{item.name}</h4>
            <p className="font-data text-[12px] text-nx-text-sec mt-1">SKU: {item.sku}</p>
          </div>

          {/* Core Analytics Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-nx-elevated/40 border border-nx-border p-4 rounded-nx-card text-center">
              <span className="text-[11px] text-nx-text-muted">Days of Stock Left</span>
              <p className="font-data text-[24px] font-bold text-nx-text mt-1">
                {daysRemaining === 999 ? '∞' : daysRemaining}
              </p>
            </div>
            <div className="bg-nx-elevated/40 border border-nx-border p-4 rounded-nx-card text-center">
              <span className="text-[11px] text-nx-text-muted">Sales Velocity</span>
              <p className="font-data text-[15px] font-bold text-nx-text mt-2">
                {dailyVelocity.toFixed(1)} <span className="text-[10px] font-normal text-nx-text-muted">units/day</span>
              </p>
            </div>
          </div>

          {/* Reorder Recommendation */}
          <div className={`p-4 rounded-nx-card border flex gap-3 ${
            isCritical ? 'bg-nx-red/5 border-nx-red/20' : 'bg-nx-cyan/5 border-nx-cyan/20'
          }`}>
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${isCritical ? 'text-nx-red' : 'text-nx-cyan'}`} />
            <div className="text-[13px]">
              <h5 className="font-bold text-nx-text">Urgency: {isCritical ? 'High' : 'Medium'}</h5>
              <p className="text-nx-text-sec leading-relaxed mt-1">
                Current stock level ({currentQty} units) is {isCritical ? 'at/below reorder threshold' : 'approaching threshold'} ({threshold} units). 
                Stockout predicted in <span className="font-data text-[12px] font-bold">{daysRemaining === 999 ? '30+' : daysRemaining} days</span>.
              </p>
            </div>
          </div>

          {/* Suggested Reorder Metrics */}
          <div className="space-y-3">
            <h5 className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Suggested Actions</h5>
            <div className="bg-nx-elevated/30 border border-nx-border rounded-nx-card p-4 space-y-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-nx-text-sec">Recommended Order Qty</span>
                <span className="font-data font-bold text-nx-text">{suggestedReorder || 15} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-nx-text-sec">Est. Cost (TZS)</span>
                <span className="font-data text-nx-text">
                  {formatCurrency((suggestedReorder || 15) * (item.cost_price || 45000))}
                </span>
              </div>
            </div>
          </div>

          {/* Supplier Context Card */}
          {item.supplier_name && (
            <div className="space-y-3">
              <h5 className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Recommended Supplier</h5>
              <div className="bg-nx-elevated/30 border border-nx-border p-4 rounded-nx-card space-y-3 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-nx-text-sec font-medium">Supplier Name</span>
                  <span className="font-bold text-nx-text">{item.supplier_name}</span>
                </div>
                {item.supplier_phone && (
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-nx-text-muted flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Call Supplier</span>
                    <span className="font-data text-nx-cyan hover:underline">{item.supplier_phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {item.supplier_id && onInitiatePO && (
          <div className="p-4 border-t border-nx-border bg-nx-elevated/50 flex shrink-0">
            <button
              onClick={handleCreatePO}
              className="w-full bg-nx-cyan hover:bg-nx-cyan/90 text-white font-medium text-[13px] py-3 rounded-nx-btn flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-sm"
            >
              <span>Generate Purchase Draft</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
