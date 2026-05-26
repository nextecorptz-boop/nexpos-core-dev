import React from 'react'
import { Trash2, Plus, Minus, CreditCard } from 'lucide-react'

interface CartItem {
  variant_id: string
  product_name: string
  size: string
  color: string | null
  quantity: number
  unit_price: number
  cost_price: number
}

interface OrderPanelProps {
  cart: CartItem[]
  onUpdateQuantity: (variantId: string, delta: number) => void
  onRemoveItem: (variantId: string) => void
  onCharge: () => void
}

export function OrderPanel({ cart, onUpdateQuantity, onRemoveItem, onCharge }: OrderPanelProps) {
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  const vat = subtotal * 0.18 // 18% VAT included
  const total = subtotal
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="w-full md:w-[320px] bg-nx-surface border-l border-nx-border flex flex-col h-[calc(100vh-140px)] shrink-0">
      <div className="p-4 border-b border-nx-border flex items-center justify-between shrink-0">
        <h2 className="font-ui text-[16px] font-bold text-nx-text">Current Order</h2>
        <span className="bg-nx-elevated text-nx-text-sec font-data text-[12px] font-bold px-2 py-0.5 rounded-full">
          {itemCount}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-nx-text-muted">
            <p className="font-ui text-[13px]">Cart is empty</p>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.variant_id} className="relative group">
              <div className="flex justify-between items-start mb-2 pr-6">
                <div>
                  <p className="font-ui text-[13px] font-semibold text-nx-text leading-tight line-clamp-2">
                    {item.product_name}
                  </p>
                  <p className="font-ui text-[11px] text-nx-text-sec mt-0.5">
                    Size: {item.size}{item.color ? ` • ${item.color}` : ''}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => onRemoveItem(item.variant_id)}
                className="absolute top-0 right-0 p-2 -mt-1 -mr-1 text-nx-text-muted hover:text-nx-red transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center bg-nx-elevated rounded-nx-xs border border-nx-border">
                  <button
                    onClick={() => onUpdateQuantity(item.variant_id, -1)}
                    className="w-8 h-8 flex items-center justify-center text-nx-text hover:text-nx-cyan transition-colors active:scale-95"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-data text-[13px] font-bold text-nx-text w-6 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQuantity(item.variant_id, 1)}
                    className="w-8 h-8 flex items-center justify-center text-nx-text hover:text-nx-cyan transition-colors active:scale-95"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <p className="font-data text-[13px] font-bold text-nx-text">
                  {new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0 }).format(item.quantity * item.unit_price)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-nx-border bg-nx-bg shrink-0">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center text-[13px]">
            <span className="font-ui text-nx-text-sec">Subtotal</span>
            <span className="font-data text-nx-text">{new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0 }).format(subtotal - vat)}</span>
          </div>
          <div className="flex justify-between items-center text-[13px]">
            <span className="font-ui text-nx-text-sec">VAT (18%)</span>
            <span className="font-data text-nx-text">{new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0 }).format(vat)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 mt-2 border-t border-nx-border/50">
            <span className="font-ui font-semibold text-nx-text text-[14px]">Total</span>
            <span className="font-data font-bold text-nx-text text-[20px]">
              {new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0 }).format(total)}
            </span>
          </div>
        </div>
        
        <button
          onClick={onCharge}
          disabled={cart.length === 0}
          className={`w-full h-[52px] rounded-nx-btn flex items-center justify-center font-ui text-[15px] font-bold transition-all duration-150 ${
            cart.length > 0 
              ? 'bg-nx-cyan text-white shadow-nx-md hover:bg-nx-cyan/90 active:scale-[0.98]' 
              : 'bg-nx-elevated text-nx-text-muted cursor-not-allowed'
          }`}
        >
          {cart.length > 0 ? `Charge TZS ${new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0 }).format(total)}` : 'Cart Empty'}
        </button>
      </div>
    </div>
  )
}
