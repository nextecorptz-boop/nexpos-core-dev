import React, { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Banknote, CreditCard, Smartphone, UserCheck } from 'lucide-react'

interface PaymentPanelProps {
  total: number
  onBack: () => void
  onConfirm: (method: string, amountTendered: number) => void
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'mpesa', label: 'M-Pesa', icon: Smartphone },
  { id: 'credit', label: 'Credit', icon: UserCheck },
]

const QUICK_CASH = [5000, 10000, 20000, 50000]

export function PaymentPanel({ total, onBack, onConfirm }: PaymentPanelProps) {
  const [method, setMethod] = useState('cash')
  const [cashTendered, setCashTendered] = useState(total.toString())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (method === 'cash' && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [method])

  const handleCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // only allow numbers
    const val = e.target.value.replace(/[^0-9]/g, '')
    setCashTendered(val)
  }

  const numericTendered = parseInt(cashTendered, 10) || 0
  const change = Math.max(0, numericTendered - total)
  
  // Validations
  const isValid = method === 'cash' ? numericTendered >= total : true

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(method, numericTendered)
    }
  }

  return (
    <div className="w-full md:w-[320px] bg-nx-surface border-l border-nx-border flex flex-col h-[calc(100vh-140px)] shrink-0">
      <div className="p-4 border-b border-nx-border flex items-center shrink-0">
        <button 
          onClick={onBack}
          className="p-1.5 -ml-1.5 mr-2 rounded-nx-xs hover:bg-nx-elevated transition-colors text-nx-text-sec hover:text-nx-text active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-ui text-[16px] font-bold text-nx-text">Payment</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <p className="font-ui text-[12px] text-nx-text-sec mb-3">Select Method</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(m => {
              const Icon = m.icon
              const isActive = method === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-nx-card border transition-all duration-150 active:scale-[0.97] ${
                    isActive 
                      ? 'border-nx-cyan bg-nx-cyan/10 text-nx-cyan shadow-nx-md' 
                      : 'border-nx-border bg-nx-surface text-nx-text hover:border-nx-text-muted hover:bg-nx-elevated'
                  }`}
                >
                  <Icon className="w-5 h-5 mb-1.5" />
                  <span className="font-ui text-[12px] font-medium">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {method === 'cash' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <p className="font-ui text-[12px] text-nx-text-sec mb-2">Cash Tendered</p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-ui text-[14px] text-nx-text-muted">TZS</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={new Intl.NumberFormat('en-TZ', { useGrouping: false }).format(numericTendered)}
                  onChange={handleCashChange}
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text font-data text-[20px] font-bold py-3 pl-14 pr-4 rounded-nx-btn focus:outline-none focus:border-nx-cyan focus:ring-1 focus:ring-nx-cyan transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {QUICK_CASH.map(amount => (
                <button
                  key={amount}
                  onClick={() => setCashTendered(amount.toString())}
                  className="bg-nx-elevated hover:bg-nx-border border border-nx-border rounded-nx-btn py-2 font-data text-[13px] text-nx-text transition-colors active:scale-95"
                >
                  {new Intl.NumberFormat('en-TZ').format(amount)}
                </button>
              ))}
            </div>

            <div className="p-4 bg-nx-bg border border-nx-border rounded-nx-card flex justify-between items-center">
              <span className="font-ui text-[13px] text-nx-text-sec">Change Due</span>
              <span className={`font-data text-[18px] font-bold ${change > 0 ? 'text-nx-green' : 'text-nx-text'}`}>
                {new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0 }).format(change)}
              </span>
            </div>
          </div>
        )}

        {method !== 'cash' && (
          <div className="flex-1 flex items-center justify-center py-8 animate-in fade-in duration-200">
            <p className="font-ui text-[13px] text-nx-text-sec text-center">
              Process {PAYMENT_METHODS.find(m => m.id === method)?.label} payment via external terminal and confirm below.
            </p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-nx-border bg-nx-bg shrink-0">
        <div className="flex justify-between items-center mb-4">
          <span className="font-ui font-semibold text-nx-text text-[14px]">Total</span>
          <span className="font-data font-bold text-nx-text text-[20px]">
            {new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0 }).format(total)}
          </span>
        </div>
        
        <button
          onClick={handleConfirm}
          disabled={!isValid}
          className={`w-full h-[52px] rounded-nx-btn flex items-center justify-center font-ui text-[15px] font-bold transition-all duration-150 ${
            isValid
              ? 'bg-nx-cyan text-white shadow-nx-md hover:bg-nx-cyan/90 active:scale-[0.98]' 
              : 'bg-nx-elevated text-nx-text-muted cursor-not-allowed'
          }`}
        >
          Confirm {PAYMENT_METHODS.find(m => m.id === method)?.label}
        </button>
      </div>
    </div>
  )
}
