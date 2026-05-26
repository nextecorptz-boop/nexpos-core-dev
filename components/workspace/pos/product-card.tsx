import React from 'react'
import { Package, CheckCircle2 } from 'lucide-react'

export interface Product {
  id: string
  name: string
  brand: string | null
  category: { name: string } | null
  category_name?: string
  variants: any[]
}

interface ProductCardProps {
  product: Product
  isSelected: boolean
  onClick: (product: Product) => void
}

export function ProductCard({ product, isSelected, onClick }: ProductCardProps) {
  // Sum available stock across all variants
  const totalStock = product.variants?.reduce((sum, v) => sum + (v.available_qty || 0), 0) || 0
  const stockState = totalStock > 5 ? 'green' : totalStock > 0 ? 'orange' : 'red'
  
  // Get base price from first variant or fallback to 0
  const displayPrice = product.variants?.[0]?.selling_price || product.variants?.[0]?.price || 0

  return (
    <button
      onClick={() => onClick(product)}
      className={`w-full flex flex-col text-left rounded-nx-card overflow-hidden transition-all duration-150 relative select-none active:scale-[0.97] ${
        isSelected 
          ? 'border-[1.5px] border-nx-cyan bg-nx-cyan/10 shadow-nx-md -translate-y-[2px]' 
          : 'border border-nx-border bg-nx-surface hover:border-nx-text-muted'
      }`}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 z-10 bg-nx-cyan rounded-full">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
      )}
      
      {/* Image Zone */}
      <div className="h-[110px] w-full bg-nx-elevated flex items-center justify-center relative">
        <Package className="w-10 h-10 text-nx-text-muted/50" />
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1">
        <p className="font-ui text-[11px] text-nx-text-muted uppercase tracking-wider mb-1 line-clamp-1">
          {product.brand || product.category?.name || product.category_name || 'Unbranded'}
        </p>
        <p className="font-ui text-[13px] font-semibold text-nx-text leading-tight line-clamp-2 mb-2 flex-1">
          {product.name}
        </p>
        
        <div className="flex items-center justify-between mt-auto pt-2">
          <p className={`font-data text-[13px] font-bold ${isSelected ? 'text-nx-cyan' : 'text-nx-text'}`}>
            {new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(displayPrice)}
          </p>
          
          <span className={`px-2 py-0.5 rounded-full font-ui text-[9px] font-medium uppercase tracking-wider ${
            stockState === 'green' ? 'bg-nx-green/10 text-nx-green' :
            stockState === 'orange' ? 'bg-nx-orange/10 text-nx-orange' :
            'bg-nx-red/10 text-nx-red'
          }`}>
            <span className="font-mono">{totalStock}</span> in stock
          </span>
        </div>
      </div>
    </button>
  )
}
