'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Users,
  CreditCard,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  RotateCcw,
  Settings,
  UserCog,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Globe,
  ClipboardList,
  Activity,
  ShieldAlert,
  ArrowLeftRight,
  Wallet
} from 'lucide-react'

function StableLogOutIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </svg>
  )
}
import { useState, useEffect } from 'react'

interface NavItem {
  name: string
  href: string
  icon: any
  roles: string[]
}

const swahiliTranslations: Record<string, string> = {
  'Dashboard': 'Mfumo Mkuu',
  'Control Center': 'Udhibiti Mkuu',
  'Point of Sale': 'Kituo cha Mauzo',
  'Orders': 'Miamala / Risiti',
  'Returns': 'Marejesho ya Bidhaa',
  'Credit': 'Mauzo ya Mkopo',
  'Till': 'Kasha la Pesa',
  'Products': 'Bidhaa / Stoki',
  'Inventory': 'Usimamizi wa Ghala',
  'Customers': 'Wateja',
  'Suppliers': 'Wasambazaji',
  'Purchases': 'Manunuzi ya Bidhaa',
  'Reports': 'Ripoti za Mauzo',
  'Sales Trends': 'Mwelekeo wa Mauzo',
  'Item Sales': 'Uchambuzi wa Bidhaa',
  'Staff Insights': 'Uchambuzi wa Wafanyakazi',
  'Expenses': 'Matumizi ya Duka',
  'Settings': 'Mipangilio',
  'Payments': 'Malipo',
  'Users': 'Watumiaji',
  'Logout': 'Ondoka',
  'Transfers': 'Uhamisho wa Stoki',
  'Security Logs': 'Kumbukumbu za Usalama',
}

export default function WorkspaceNav({ user }: { user: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [lang, setLang] = useState<'en' | 'sw'>('en')

  // Sync collapsed state to document root for layout padding calculations
  useEffect(() => {
    if (isCollapsed) {
      document.documentElement.classList.add('sidebar-collapsed')
    } else {
      document.documentElement.classList.remove('sidebar-collapsed')
    }
  }, [isCollapsed])

  // Load language from localStorage if available
  useEffect(() => {
    const savedLang = localStorage.getItem('nx-lang') as 'en' | 'sw'
    if (savedLang) setLang(savedLang)
  }, [])

  const toggleLanguage = () => {
    const newLang = lang === 'en' ? 'sw' : 'en'
    setLang(newLang)
    localStorage.setItem('nx-lang', newLang)
    // Dispatch custom event to let other components know the language changed
    window.dispatchEvent(new Event('nx-lang-change'))
  }

  const t = (key: string) => {
    if (lang === 'sw') {
      return swahiliTranslations[key] || key
    }
    return key
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Sidebar Groups
  const sellGroup: NavItem[] = [
    { name: 'Point of Sale', href: '/app/pos', icon: ShoppingCart, roles: ['owner', 'manager', 'cashier'] },
    { name: 'Orders', href: '/app/orders', icon: ClipboardList, roles: ['owner', 'manager', 'cashier'] },
    { name: 'Returns', href: '/app/returns', icon: RotateCcw, roles: ['owner', 'manager', 'cashier'] },
    { name: 'Credit', href: '/app/credit', icon: CreditCard, roles: ['owner', 'manager'] },
    { name: 'Till', href: '/app/till', icon: DollarSign, roles: ['owner', 'manager', 'cashier'] },
  ]

  const manageGroup: NavItem[] = [
    { name: 'Products', href: '/app/products', icon: Package, roles: ['owner', 'manager'] },
    { name: 'Inventory', href: '/app/inventory', icon: Warehouse, roles: ['owner', 'manager'] },
    { name: 'Transfers', href: '/app/transfers', icon: ArrowLeftRight, roles: ['owner', 'manager'] },
    { name: 'Customers', href: '/app/customers', icon: Users, roles: ['owner', 'manager', 'cashier'] },
    { name: 'Suppliers', href: '/app/suppliers', icon: Users, roles: ['owner', 'manager'] },
    { name: 'Purchases', href: '/app/purchases', icon: ShoppingBag, roles: ['owner', 'manager'] },
  ]

  const analyzeGroup: NavItem[] = [
    { name: 'Sales Trends', href: '/app/sales/trends', icon: TrendingUp, roles: ['owner', 'manager'] },
    { name: 'Item Sales', href: '/app/sales/items', icon: Package, roles: ['owner', 'manager'] },
    { name: 'Staff Insights', href: '/app/staff-insights', icon: UserCog, roles: ['owner', 'manager'] },
    { name: 'Expenses', href: '/app/expenses', icon: DollarSign, roles: ['owner', 'manager'] },
  ]

  const systemGroup: NavItem[] = [
    { name: 'Payments', href: '/app/payments', icon: Wallet, roles: ['owner', 'manager'] },
    { name: 'Security Logs', href: '/app/security-log', icon: ShieldAlert, roles: ['owner'] },
    { name: 'Settings', href: '/app/settings', icon: Settings, roles: ['owner'] },
    { name: 'Users', href: '/app/users', icon: UserCog, roles: ['owner'] },
  ]


  const homeHref = user.role === 'cashier' ? '/app/pos' : '/app/dashboard'

  const filterByRole = (items: NavItem[]) => items.filter(item => item.roles.includes(user.role))

  const headerGroup: NavItem[] = [
    { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard, roles: ['owner', 'manager'] },
    { name: 'Control Center', href: '/app/control-center', icon: Activity, roles: ['owner', 'manager'] },
  ]

  const activeHeaderItems = filterByRole(headerGroup)
  const activeSellItems = filterByRole(sellGroup)
  const activeManageItems = filterByRole(manageGroup)
  const activeAnalyzeItems = filterByRole(analyzeGroup)
  const activeSystemItems = filterByRole(systemGroup)

  const renderLink = (item: NavItem) => {
    const isActive = pathname === item.href
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileMenuOpen(false)}
        title={isCollapsed ? t(item.name) : undefined}
        className={`
          flex items-center gap-3 px-3 py-3 transition-all duration-150 rounded-nx-xs group/item h-11
          ${isActive 
            ? 'bg-nx-cyan/10 text-nx-cyan border-l-2 border-nx-cyan font-semibold' 
            : 'text-nx-text-sec hover:text-nx-text hover:bg-nx-elevated'
          }
        `}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? 'text-nx-cyan' : 'text-nx-text-sec group-hover/item:text-nx-text'}`} />
        {!isCollapsed && (
          <span className="font-ui text-[13px] tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
            {t(item.name)}
          </span>
        )}
      </Link>
    )
  }

  return (
    <>
      {/* Mobile Top Header (only visible on mobile/tablet screen widths) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-nx-surface border-b border-nx-border z-30 flex items-center justify-between px-6">
        <Link href={homeHref} className="font-ui text-xl font-bold tracking-wider text-nx-text">
          NEX<span className="text-nx-cyan">POS</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="bg-nx-elevated p-2.5 rounded-nx-xs text-nx-text border border-nx-border"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <nav className={`
        fixed top-0 left-0 h-full bg-nx-surface border-r border-nx-border z-40
        transform transition-all duration-200 ease-in-out flex flex-col justify-between
        ${mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'lg:w-16' : 'lg:w-60'}
      `}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Brand Logo Zone */}
          <div className="p-4 border-b border-nx-border h-16 flex items-center justify-between">
            {(!isCollapsed || mobileMenuOpen) ? (
              <Link href={homeHref} className="font-ui text-xl font-extrabold tracking-wider text-nx-text select-none">
                NEX<span className="text-nx-cyan">POS</span>
              </Link>
            ) : (
              <Link href={homeHref} className="font-ui text-lg font-black text-nx-cyan select-none mx-auto">
                NX
              </Link>
            )}
            
            {/* Collapse Toggle Button (Desktop only) */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex p-1 hover:bg-nx-elevated border border-transparent hover:border-nx-border rounded-nx-xs text-nx-text-sec hover:text-nx-text transition-colors"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Scrollable Navigation links */}
          <div className="flex-1 overflow-y-auto py-4 no-scrollbar space-y-5 px-3">
            {/* Top Dashboard + Control Center — owner/manager only */}
            {activeHeaderItems.length > 0 && (
              <div className="space-y-1">
                {activeHeaderItems.map(renderLink)}
              </div>
            )}

            {/* SELL GROUP */}
            {activeSellItems.length > 0 && (
              <div className="space-y-1">
                {(!isCollapsed || mobileMenuOpen) ? (
                  <p className="px-3 text-[10px] font-bold text-nx-text-muted uppercase tracking-widest mb-1.5 mt-3 select-none">
                    {t('SELL')}
                  </p>
                ) : (
                  <div className="border-t border-nx-border/50 my-3" />
                )}
                {activeSellItems.map(renderLink)}
              </div>
            )}

            {/* MANAGE GROUP */}
            {activeManageItems.length > 0 && (
              <div className="space-y-1">
                {(!isCollapsed || mobileMenuOpen) ? (
                  <p className="px-3 text-[10px] font-bold text-nx-text-muted uppercase tracking-widest mb-1.5 mt-3 select-none">
                    {t('MANAGE')}
                  </p>
                ) : (
                  <div className="border-t border-nx-border/50 my-3" />
                )}
                {activeManageItems.map(renderLink)}
              </div>
            )}

            {/* ANALYZE GROUP */}
            {activeAnalyzeItems.length > 0 && (
              <div className="space-y-1">
                {(!isCollapsed || mobileMenuOpen) ? (
                  <p className="px-3 text-[10px] font-bold text-nx-text-muted uppercase tracking-widest mb-1.5 mt-3 select-none">
                    {t('ANALYZE')}
                  </p>
                ) : (
                  <div className="border-t border-nx-border/50 my-3" />
                )}
                {activeAnalyzeItems.map(renderLink)}
              </div>
            )}

            {/* SYSTEM GROUP */}
            {activeSystemItems.length > 0 && (
              <div className="space-y-1">
                {(!isCollapsed || mobileMenuOpen) ? (
                  <p className="px-3 text-[10px] font-bold text-nx-text-muted uppercase tracking-widest mb-1.5 mt-3 select-none">
                    {t('SYSTEM')}
                  </p>
                ) : (
                  <div className="border-t border-nx-border/50 my-3" />
                )}
                {activeSystemItems.map(renderLink)}
              </div>
            )}
          </div>

          {/* Footer controls & Profile block */}
          <div className="p-3 border-t border-nx-border bg-nx-surface flex-shrink-0 space-y-2">
            {/* Language Selection */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-3 px-3 py-2 text-nx-text-sec hover:text-nx-text hover:bg-nx-elevated rounded-nx-xs w-full transition-colors h-10 overflow-hidden"
              title={isCollapsed ? `Language: ${lang.toUpperCase()}` : undefined}
            >
              <Globe className="w-5 h-5 text-nx-text-sec flex-shrink-0" />
              {(!isCollapsed || mobileMenuOpen) && (
                <span className="font-ui text-xs tracking-wider flex items-center justify-between w-full">
                  <span>Language</span>
                  <span className="bg-nx-cyan/15 text-nx-cyan px-2 py-0.5 text-[10px] font-bold rounded-full">
                    {lang === 'en' ? 'ENG' : 'SWA'}
                  </span>
                </span>
              )}
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 text-nx-text-sec hover:text-nx-red hover:bg-nx-red/10 rounded-nx-xs w-full transition-colors h-10 overflow-hidden"
              title={isCollapsed ? t('Logout') : undefined}
            >
              <StableLogOutIcon className="w-5 h-5 flex-shrink-0" />
              {(!isCollapsed || mobileMenuOpen) && (
                <span className="font-ui text-[13px] tracking-wide whitespace-nowrap">{t('Logout')}</span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile background overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-30 transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
