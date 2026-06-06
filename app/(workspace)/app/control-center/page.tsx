import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function fmt(val: number): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(val)
}

function HealthCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'green' | 'gold' | 'red' | 'neutral'
}) {
  const valueClass =
    tone === 'green'
      ? 'text-nx-green'
      : tone === 'gold'
        ? 'text-nx-gold'
        : tone === 'red'
          ? 'text-nx-red'
          : 'text-nx-text'
  return (
    <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
      <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <p className={`font-data text-[22px] font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-nx-text-muted mt-1">{sub}</p>}
    </div>
  )
}

function AlertRow({
  icon: Icon,
  message,
  tone,
  href,
}: {
  icon: any
  message: string
  tone: 'red' | 'gold' | 'green'
  href?: string
}) {
  const cls =
    tone === 'red'
      ? 'bg-nx-red/5 border-nx-red/20 text-nx-red'
      : tone === 'gold'
        ? 'bg-nx-amber/5 border-nx-amber/20 text-nx-amber'
        : 'bg-nx-green/5 border-nx-green/20 text-nx-green'
  return (
    <div
      className={`flex items-center gap-3 border rounded-nx-xs px-4 py-2.5 text-[12px] font-medium ${cls}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {href && (
        <Link href={href} className="opacity-70 hover:opacity-100 transition-opacity">
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  )
}

export default async function ControlCenterPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  // Parallel data fetch — all queries use existing tables/views only
  const [
    todaySalesRes,
    weekSalesRes,
    productCountRes,
    customerCountRes,
    branchCountRes,
    lowStockRes,
    creditSalesRes,
    recentSalesRes,
  ] = await Promise.all([
    // Revenue today
    supabase
      .from('sales')
      .select('id, total')
      .gte('completed_at', today)
      .eq('status', 'completed'),
    // Revenue last 7d
    supabase
      .from('sales')
      .select('id, total')
      .gte('completed_at', sevenDaysAgo)
      .eq('status', 'completed'),
    // Active products
    supabase
      .from('product_families')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    // Customers
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('is_active', true),
    // Branches
    supabase.from('branches').select('*', { count: 'exact', head: true }).eq('is_active', true),
    // Low stock items (on_hand <= reorder_point)
    supabase
      .from('stock_levels')
      .select('variant_id, on_hand, reorder_point, product_variants(sku, product_families(name))')
      .limit(50),
    // Credit outstanding (sales paid by credit)
    supabase
      .from('sales')
      .select('id, total')
      .eq('payment_method', 'credit')
      .eq('status', 'completed'),
    // Recent 6 sales
    supabase
      .from('sales')
      .select('id, receipt_number, completed_at, total, status, payment_method')
      .order('completed_at', { ascending: false })
      .limit(6),
  ])

  const todaySales = todaySalesRes.data ?? []
  const weekSales = weekSalesRes.data ?? []
  const todayRevenue = todaySales.reduce((s, r) => s + Number(r.total), 0)
  const weekRevenue = weekSales.reduce((s, r) => s + Number(r.total), 0)
  const creditOutstanding = (creditSalesRes.data ?? []).reduce((s, r) => s + Number(r.total), 0)

  const lowStockItems = ((lowStockRes.data ?? []) as any[]).filter(
    (item) => Number(item.on_hand) <= Number(item.reorder_point ?? 0)
  )

  const productCount = productCountRes.count ?? 0
  const customerCount = customerCountRes.count ?? 0
  const branchCount = branchCountRes.count ?? 0
  const recentSales = (recentSalesRes.data ?? []) as any[]

  // Build operational alerts
  const alerts: { icon: any; message: string; tone: 'red' | 'gold' | 'green'; href?: string }[] =
    []

  if (lowStockItems.length > 0) {
    alerts.push({
      icon: AlertTriangle,
      message: `${lowStockItems.length} product variant${lowStockItems.length > 1 ? 's' : ''} at or below reorder point`,
      tone: 'red',
      href: '/app/inventory',
    })
  }
  if (creditOutstanding > 0) {
    alerts.push({
      icon: CreditCard,
      message: `${fmt(creditOutstanding)} outstanding in credit sales — review ledger`,
      tone: 'gold',
      href: '/app/credit',
    })
  }
  if (todaySales.length === 0) {
    alerts.push({
      icon: ShoppingCart,
      message: 'No sales recorded today — till may not be open',
      tone: 'gold',
      href: '/app/pos',
    })
  }
  if (alerts.length === 0) {
    alerts.push({
      icon: CheckCircle2,
      message: 'No active alerts — operations appear healthy',
      tone: 'green',
    })
  }

  const dayAvg = weekRevenue > 0 ? weekRevenue / 7 : 0

  // Module activation status
  const modules = [
    { name: 'Point of Sale', active: true, href: '/app/pos' },
    { name: 'Orders', active: true, href: '/app/orders' },
    { name: 'Inventory', active: true, href: '/app/inventory' },
    { name: 'Till Sessions', active: false, href: '/app/till' },
    { name: 'Returns Backend', active: false, href: '/app/returns' },
    { name: 'Supplier Registry', active: false, href: '/app/suppliers' },
    { name: 'Purchase Orders', active: false, href: '/app/purchases' },
    { name: 'Expense Tracking', active: false, href: '/app/expenses' },
    { name: 'SeerBit Payments', active: false, href: '/app/payments' },
  ]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-nx-green" />
            <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3]">
              Control Center
            </h1>
          </div>
          <p className="text-nx-text-sec text-[12px]">
            {greeting}, {user.full_name.split(' ')[0]}. Owner command layer —{' '}
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <Link
          href="/app/pos"
          className="flex items-center gap-2 bg-nx-green hover:bg-nx-green-bright px-4 py-2 rounded-nx-btn text-[13px] font-semibold transition-all active:scale-[0.97]"
          style={{ color: '#04210F' }}
        >
          <ShoppingCart className="w-4 h-4" />
          Open POS
        </Link>
      </div>

      {/* Zone 1: Business Vitals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-6 select-none">
        <HealthCard
          label="Revenue Today"
          value={fmt(todayRevenue)}
          sub={`${todaySales.length} transaction${todaySales.length !== 1 ? 's' : ''}`}
          tone={todayRevenue > 0 ? 'green' : 'neutral'}
        />
        <HealthCard
          label="7-Day Revenue"
          value={fmt(weekRevenue)}
          sub={`${fmt(dayAvg)} daily avg`}
          tone="gold"
        />
        <HealthCard
          label="Active Products"
          value={String(productCount)}
          sub={`${lowStockItems.length} low stock alert${lowStockItems.length !== 1 ? 's' : ''}`}
          tone={lowStockItems.length > 0 ? 'red' : 'neutral'}
        />
        <HealthCard
          label="Customers"
          value={String(customerCount)}
          sub={`${branchCount} active branch${branchCount !== 1 ? 'es' : ''}`}
        />
      </div>

      {/* Zone 2: Alerts + Recent Activity */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-[14px] mb-6">
        {/* Operational Alerts */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <div className="flex items-center gap-2 mb-4 select-none">
            <Activity className="w-4 h-4 text-nx-text-sec" />
            <h3 className="font-ui text-[14px] font-semibold text-nx-text">Operational Alerts</h3>
            <span className="ml-auto font-data text-[11px] text-nx-text-muted">
              {alerts.filter((a) => a.tone !== 'green').length} active
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {alerts.map((a, i) => (
              <AlertRow key={i} {...a} />
            ))}
          </div>

          {/* Low stock detail */}
          {lowStockItems.length > 0 && (
            <div className="mt-4 border-t border-nx-border/50 pt-4">
              <p className="text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-2">
                Low Stock Items
              </p>
              <div className="space-y-1.5">
                {lowStockItems.slice(0, 5).map((item: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[12px]"
                  >
                    <span className="text-nx-text">
                      {(item.product_variants as any)?.product_families?.name ?? item.variant_id}
                    </span>
                    <span className="font-data font-bold text-nx-red">
                      {item.on_hand} / {item.reorder_point ?? 0}
                    </span>
                  </div>
                ))}
                {lowStockItems.length > 5 && (
                  <Link
                    href="/app/inventory"
                    className="text-[11px] text-nx-green hover:text-nx-green-bright transition-colors"
                  >
                    + {lowStockItems.length - 5} more →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
          <div className="flex items-center justify-between mb-4 select-none">
            <h3 className="font-ui text-[14px] font-semibold text-nx-text">Recent Transactions</h3>
            <Link
              href="/app/orders"
              className="text-[11px] text-nx-green hover:text-nx-green-bright transition-colors"
            >
              View all →
            </Link>
          </div>
          {recentSales.length === 0 ? (
            <p className="text-[12px] text-nx-text-muted py-6 text-center">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {recentSales.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-[12px] border-b border-nx-border/50 pb-2.5 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-data text-nx-text-sec text-[11px]">{s.receipt_number}</p>
                    <p className="text-nx-text-muted text-[11px] capitalize">
                      {s.payment_method?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-data font-semibold text-nx-text">{fmt(Number(s.total))}</p>
                    <p className="text-nx-text-muted text-[10px]">
                      {new Date(s.completed_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zone 3: Module Activation Status */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4 select-none">
          <h3 className="font-ui text-[14px] font-semibold text-nx-text">Module Status</h3>
          <span className="font-data text-[11px] text-nx-text-muted">
            {modules.filter((m) => m.active).length} / {modules.length} active
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {modules.map((mod) => (
            <Link
              key={mod.name}
              href={mod.href}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-nx-xs border text-[12px] font-medium transition-colors ${
                mod.active
                  ? 'border-nx-green/30 bg-nx-green/5 text-nx-green hover:bg-nx-green/10'
                  : 'border-nx-border bg-nx-elevated text-nx-text-muted hover:text-nx-text'
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${mod.active ? 'bg-nx-green' : 'bg-nx-border-strong'}`}
              />
              {mod.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Zone 4: Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[14px] select-none">
        {[
          { label: 'Staff Analytics', href: '/app/staff-insights', icon: Users },
          { label: 'Sales Trends', href: '/app/sales/trends', icon: TrendingUp },
          { label: 'Item Performance', href: '/app/sales/items', icon: Package },
          { label: 'Credit Ledger', href: '/app/credit', icon: CreditCard },
        ].map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="bg-nx-surface border border-nx-border rounded-nx-card p-4 flex items-center gap-3 hover:border-nx-green/40 hover:shadow-nx-md transition-all duration-150 active:scale-[0.97] group"
          >
            <div className="w-10 h-10 rounded-full bg-nx-elevated flex items-center justify-center text-nx-text-sec group-hover:bg-nx-green/10 group-hover:text-nx-green transition-colors flex-shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <span className="font-ui text-[13px] font-medium text-nx-text">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
