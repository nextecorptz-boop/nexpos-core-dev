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

    // 1. Register Service Worker manually
    if ('serviceWorker' in navigator) {
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
                  // New update available, show notification
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

      {/* PWA Install Banner - Swahili + English */}
      {showInstallBanner && (
        <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 z-50 bg-white border border-cyan-100 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start justify-between">
            <div className="flex gap-3">
              <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">Sakinisha NEXPOS</h4>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Sakinisha App kwa utendaji wa haraka na matumizi ya nje ya mtandao (offline).
                </p>
                <p className="text-[10px] text-cyan-600 font-medium mt-1">
                  Install app for offline capabilities & speed.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            Sakinisha Sasa (Install Now)
          </button>
        </div>
      )}

      {/* Forced Update Modal - SemVer Protection */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-cyan-100 max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 bg-cyan-50 text-cyan-600 rounded-full animate-spin duration-1000">
                <RefreshCw className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Maboresho Mapya Yapo Tayari</h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                  Toleo jipya la mfumo limepakuliwa. Unatakiwa kusasisha sasa ili kuzuia hitilafu za mfumo.
                </p>
                <p className="text-xs text-cyan-600 font-medium mt-1 leading-relaxed">
                  A system update is ready. You must reload to apply improvements and maintain sync compatibility.
                </p>
              </div>
              <button
                onClick={handleUpdateClick}
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-semibold shadow-md transition-all mt-2"
              >
                Bonyeza Kusasisha (Update Now)
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
