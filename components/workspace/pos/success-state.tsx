import React, { useEffect } from 'react'
import { CheckCircle } from 'lucide-react'

interface SuccessStateProps {
  total: number
  onComplete: () => void
}

export function SuccessState({ total, onComplete }: SuccessStateProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete()
    }, 2000)
    
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="w-full md:w-[320px] bg-nx-surface border-l border-nx-border flex flex-col items-center justify-center h-[calc(100vh-140px)] shrink-0 animate-in fade-in duration-300">
      <div className="bg-nx-green/10 rounded-full p-4 mb-4 animate-in zoom-in duration-300 delay-100 fill-mode-both">
        <CheckCircle className="w-16 h-16 text-nx-green" />
      </div>
      
      <h2 className="font-ui text-[20px] font-bold text-nx-text mb-2">Payment Received</h2>
      
      <p className="font-data text-[24px] font-bold text-nx-cyan">
        {new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(total)}
      </p>
      
      <p className="font-ui text-[12px] text-nx-text-sec mt-8 text-center px-6">
        Processing transaction...<br/>Ready for next customer.
      </p>
    </div>
  )
}
