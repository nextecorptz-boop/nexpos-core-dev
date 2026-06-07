'use client'

import React, { useEffect, useState } from 'react'
import { Sparkles, Download, RefreshCw, X, ShieldAlert } from 'lucide-react'

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [isolationState, setIsolationState] = useState<{ isolated: boolean; reason: string | null }>({ isolated: false, reason: null })

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Run hardware and database startup checks
    import('@/lib/db/startup-checks').then(async ({ runStartupIntegrityChecks }) => {
      const check = await runStartupIntegrityChecks();
      if (check.isolated) {
        setIsolationState({ isolated: true, reason: check.status });
      }
    });

    // 1. Register Service Worker manually (production only)
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV !== 'production') {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
      } else {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('NEXPOS Service Worker registered with scope:', reg.scope)
            setRegistration(reg)

            // Check for updates
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    setShowUpdateModal(true)
                  }
                })
              }
            })
          })
          .catch((err) => {
            console.error('Service worker registration failed:', err)
          })
      }
    }

    // 2. Listen for BeforeInstallPrompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`Install user choice outcome: ${outcome}`)
    setDeferredPrompt(null)
    setShowInstallBanner(false)
  }

  const handleUpdateClick = () => {
    if (registration && registration.waiting) {
      // Send skip waiting message
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    setShowUpdateModal(false)
    window.location.reload()
  }

  return (
    <>
      {children}

      {/* PWA Install Banner — NEXPOS dark design, language-aware */}
      {showInstallBanner && (() => {
        const isSw = typeof window !== 'undefined' && localStorage.getItem('nx-lang') === 'sw'
        const copy = isSw
          ? {
              title: 'Sakinisha NEXPOS',
              body: 'Sakinisha app kwa ufikiaji wa haraka na matumizi yaliyo tayari nje ya mtandao.',
              btn: 'Sakinisha Sasa',
            }
          : {
              title: 'Install NEXPOS',
              body: 'Install the app for faster access and offline-ready workflows.',
              btn: 'Install Now',
            }
        return (
          <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[360px] z-50 bg-[#121512] border border-[#262B25] shadow-2xl rounded-[12px] p-4 flex flex-col gap-3 animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3 items-start">
                <div className="p-2 rounded-[8px] bg-[#25C26E]/10 text-[#25C26E] flex-shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-ui font-semibold text-[#F1F4EF] text-[14px] leading-snug">{copy.title}</h4>
                  <p className="font-ui text-[12px] text-[#A3AA9F] mt-0.5 leading-relaxed">{copy.body}</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallBanner(false)}
                aria-label="Dismiss install banner"
                className="text-[#727A6E] hover:text-[#F1F4EF] transition-colors p-1 flex-shrink-0 -mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#25C26E] hover:bg-[#1fa85e] text-[#04210F] rounded-[8px] text-[13px] font-ui font-semibold transition-all active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              {copy.btn}
            </button>
          </div>
        )
      })()}

      {/* Forced Update Modal - SemVer Protection */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121512] rounded-[12px] border border-[#262B25] max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 bg-[#25C26E]/10 text-[#25C26E] rounded-full">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h3 className="font-ui text-[16px] font-bold text-[#F1F4EF]">System Update Ready</h3>
                <p className="font-ui text-[13px] text-[#A3AA9F] mt-2 leading-relaxed">
                  A new version has been downloaded. Reload now to apply improvements and maintain sync compatibility.
                </p>
              </div>
              <button
                onClick={handleUpdateClick}
                className="w-full py-2.5 px-4 bg-[#25C26E] hover:bg-[#1fa85e] text-[#04210F] rounded-[8px] font-ui text-[13px] font-semibold transition-all active:scale-[0.98] mt-2"
              >
                Update Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Isolation Modal Overlay */}
      {isolationState.isolated && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-500 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-full animate-bounce">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {isolationState.reason === 'CLIENT_ISOLATED_STALE' 
                    ? 'Kifaa Kimejitenga (Device Isolated)' 
                    : 'Toleo Halioani (Version Incompatible)'}
                </h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                  {isolationState.reason === 'CLIENT_ISOLATED_STALE'
                    ? 'Kifaa hiki hakijaunganishwa na seva kwa zaidi ya siku 14. Mauzo ya nje ya mtandao yamesimamishwa ili kuzuia hitilafu za hesabu.'
                    : 'Toleo la mfumo kwenye kifaa hiki halioani na toleo la hifadhidata ya seva. Unatakiwa kusasisha app kwanza.'}
                </p>
                <p className="text-xs text-red-600 font-medium mt-1 leading-relaxed">
                  {isolationState.reason === 'CLIENT_ISOLATED_STALE'
                    ? 'This terminal has not synced for >14 days. Offline operations are suspended to protect inventory integrity. Please contact your manager.'
                    : 'System version mismatch detected. An administrator must update this client before operations can continue.'}
                </p>
              </div>
              <div className="w-full flex flex-col gap-2 mt-2">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold shadow-md transition-all"
                >
                  Jaribu Tena (Retry Reload)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
