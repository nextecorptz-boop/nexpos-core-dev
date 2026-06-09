import React from 'react'
import { X } from 'lucide-react'

interface VariantPanelProps {
  product: any
  isOpen: boolean
  onClose: () => void
  onSelectVariant: (variant: any) => void
}

export function VariantPanel({ product, isOpen, onClose, onSelectVariant }: VariantPanelProps) {
  return (
    <div 
      className={`h-[calc(100vh-140px)] bg-nx-surface border-l border-nx-border transition-all duration-200 overflow-hidden flex flex-col shrink-0 ${
        isOpen ? 'w-[260px]' : 'w-0 border-transparent'
      }`}
    >
      {isOpen && product && (
        <>
          <div className="flex items-center justify-between p-4 border-b border-nx-border shrink-0">
            <h3 className="font-ui text-[14px] font-semibold text-nx-text truncate pr-2">
              Select Size
            </h3>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-nx-xs hover:bg-nx-elevated transition-colors text-nx-text-sec hover:text-nx-text"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <p className="font-ui text-[13px] text-nx-text font-medium mb-1 line-clamp-2">
              {product.name}
            </p>
            <p className="font-data text-[13px] font-bold text-nx-cyan mb-6">
              {new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(product.variants?.[0]?.selling_price || product.variants?.[0]?.sell_price || 0)}
            </p>

            <div className="grid grid-cols-3 gap-3">
              {product.variants?.map((variant: any) => {
                const stock = variant.available_qty ?? 0
                const isOutOfStock = stock <= 0
                const isLowStock = stock > 0 && stock <= (variant.low_stock_threshold || 5)

                return (
                  <button
                    key={variant.id}
                    disabled={isOutOfStock}
                    onClick={() => onSelectVariant(variant)}
                    className={`h-[52px] rounded-nx-btn flex flex-col items-center justify-center transition-all duration-150 active:scale-[0.97] ${
                      isOutOfStock 
                        ? 'opacity-35 cursor-not-allowed border border-nx-border bg-nx-surface'
                        : isLowStock
                          ? 'border-[1.5px] border-nx-orange hover:bg-nx-orange/10 bg-nx-surface'
                          : 'border border-nx-border hover:border-nx-cyan hover:bg-nx-cyan/10 bg-nx-surface'
                    }`}
                  >
                    <span className={`font-ui font-semibold ${isOutOfStock ? 'text-nx-text-muted' : 'text-nx-text'}`}>
                      {variant.size}
                    </span>
                    {stock > 0 && (
                      <span className={`font-ui text-[9px] font-bold uppercase mt-0.5 ${isLowStock ? 'text-nx-orange' : 'text-nx-text-muted'}`}>
                        <span className="font-mono">{stock}</span> left
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
