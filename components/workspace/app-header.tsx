'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Store, User, Bell } from 'lucide-react'

interface AppHeaderProps {
  user: {
    full_name: string
    role: string
    branch_id: string | null
  }
}

const swahiliTranslations: Record<string, string> = {
  'HQ / All Branches': 'Makao Makuu / Matawi Yote',
  'Active Branch': 'Tawi Linalofanya Kazi',
  'Online': 'Imeunganishwa',
  'Offline': 'Haipo Mtandaoni',
  'owner': 'Mmiliki',
  'manager': 'Meneja',
  'cashier': 'Mweka Hazina',
}

export default function AppHeader({ user }: AppHeaderProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [lang, setLang] = useState<'en' | 'sw'>('en')

  useEffect(() => {
    setIsOnline(navigator.onLine)
    
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const handleLangChange = () => {
      const savedLang = localStorage.getItem('nx-lang') as 'en' | 'sw'
      if (savedLang) setLang(savedLang)
    }
    window.addEventListener('nx-lang-change', handleLangChange)
    handleLangChange()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('nx-lang-change', handleLangChange)
    }
  }, [])

  const t = (key: string) => {
    if (lang === 'sw') {
      return swahiliTranslations[key] || key
    }
    return key
  }

  const formatRole = (role: string) => {
    return t(role).toUpperCase()
  }

  return (
    <header className="hidden lg:flex items-center justify-between h-16 px-8 border-b border-nx-border bg-nx-surface/50 backdrop-blur-md sticky top-0 z-20 select-none">
      {/* Active Branch Section */}
      <div className="flex items-center gap-2">
        <Store className="w-4 h-4 text-nx-cyan" />
        <span className="font-ui text-xs font-semibold text-nx-text-sec uppercase tracking-wider">
          {t('Active Branch')}:
        </span>
        <span className="font-ui text-[13px] text-nx-text font-medium bg-nx-elevated px-2.5 py-1 rounded-nx-xs border border-nx-border">
          {user.role === 'owner' ? t('HQ / All Branches') : (user.branch_id ? `Branch ID: ${user.branch_id.slice(0, 8)}` : 'N/A')}
        </span>
      </div>

      {/* Utilities / Profile Section */}
      <div className="flex items-center gap-6">
        {/* Network Status Badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold select-none border transition-colors duration-200 ${
          isOnline
            ? 'bg-nx-green/10 text-nx-green border-nx-green/20'
            : 'bg-nx-red/10 text-nx-red border-nx-red/20'
        }`}>
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span className="font-ui tracking-wide">{t('Online')}</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              <span className="font-ui tracking-wide">{t('Offline')}</span>
            </>
          )}
        </div>

        {/* User Block */}
        <div className="flex items-center gap-3 pl-4 border-l border-nx-border">
          <div className="flex flex-col text-right">
            <span className="font-ui text-[13px] font-semibold text-nx-text leading-tight">
              {user.full_name}
            </span>
            <span className="font-ui text-[10px] font-bold text-nx-cyan leading-none mt-0.5 tracking-wider">
              {formatRole(user.role)}
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-nx-elevated border border-nx-border flex items-center justify-center text-nx-text-sec">
            <User className="w-4 h-4 text-nx-cyan" />
          </div>
        </div>
      </div>
    </header>
  )
}
