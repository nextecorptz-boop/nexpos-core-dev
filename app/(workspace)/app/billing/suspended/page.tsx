'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { AlertTriangle, LogOut, Mail, RefreshCw } from 'lucide-react'
import { useState } from 'react'

export default function SuspendedPage() {
  const router = useRouter()
  const supabase = createClient()
  const [checking, setChecking] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const checkStatus = async () => {
    setChecking(true)
    // Clear cookies/caches and refresh dashboard
    router.refresh()
    setTimeout(() => {
      setChecking(false)
      router.push('/app/dashboard')
    }, 1500)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-12 px-4 text-center">
      <div className="max-w-md w-full glass-card p-8 border border-destructive/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-destructive/50 to-transparent" />
        
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive mb-6">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h1 className="font-display text-3xl font-bold text-nx-text mb-3">
          Workspace Suspended
        </h1>
        
        <p className="text-nx-text-sec text-sm mb-6 leading-relaxed">
          Your subscription is currently inactive or suspended. This usually happens due to a lapsed payment or a cancelled PayPal subscription.
        </p>

        <div className="bg-nx-surface border border-nx-border p-4 rounded mb-8 text-left space-y-2">
          <span className="block font-label uppercase text-[10px] tracking-wider text-nx-text-sec">
            How to resolve:
          </span>
          <p className="text-xs text-nx-text-sec leading-relaxed">
            1. Ensure your PayPal payment method is up to date.<br />
            2. Contact the system administrator or billing owner.<br />
            3. If you have recently updated your payment, click the verification button below.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={checkStatus}
            disabled={checking}
            className="btn-primary flex items-center justify-center gap-2 px-6 py-3"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Verifying...' : 'Check Payment Status'}
          </button>
          
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 border border-nx-border text-nx-text hover:bg-nx-surface px-6 py-3 transition-colors duration-200"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        <div className="mt-8 border-t border-nx-border pt-6 flex items-center justify-center gap-2 text-nx-text-sec hover:text-nx-text transition-colors duration-200 text-xs">
          <Mail className="w-3.5 h-3.5" />
          <span>Support: billing@nexpos.com</span>
        </div>
      </div>
    </div>
  )
}
