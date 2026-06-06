import { requireRole } from '@/lib/auth/session'
import { Bell, LockKeyhole } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  await requireRole(['owner', 'manager', 'cashier'])

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-nx-text-sec" />
            <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3]">
              Notifications
            </h1>
          </div>
          <p className="text-nx-text-sec text-[12px]">
            System alerts, low stock warnings, and operational updates
          </p>
        </div>
        <button
          disabled
          aria-disabled="true"
          className="flex items-center gap-2 bg-nx-elevated border border-nx-border text-nx-text-muted px-4 py-2 rounded-nx-btn text-[13px] font-medium cursor-not-allowed opacity-60 select-none"
        >
          <LockKeyhole className="w-4 h-4" />
          Mark All Read
        </button>
      </div>

      {/* Unread count row */}
      <div className="flex items-center gap-4 mb-6 select-none">
        {['All', 'Unread', 'Alerts', 'System'].map((tab, i) => (
          <button
            key={tab}
            disabled
            className={`px-4 py-1.5 text-[12px] font-medium rounded-[6px] cursor-not-allowed select-none ${
              i === 0
                ? 'bg-nx-elevated text-nx-text-sec border border-nx-border'
                : 'text-nx-text-muted opacity-40'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Empty state */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card py-20 flex flex-col items-center gap-3 select-none">
        <Bell className="w-10 h-10 text-nx-text-faint" />
        <p className="font-ui text-[14px] font-semibold text-nx-text-sec">No notifications</p>
        <p className="text-[12px] text-nx-text-muted text-center max-w-xs">
          Real-time alerts — low stock thresholds, failed transactions, and shift summaries — will
          appear here once the notification engine is activated.
        </p>
      </div>

      {/* Footer notice */}
      <div className="flex items-start gap-3 bg-nx-surface border border-nx-border/50 rounded-nx-card px-5 py-4 mt-6 select-none">
        <LockKeyhole className="w-4 h-4 text-nx-text-muted flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-nx-text-muted leading-relaxed">
          The notification engine will deliver real-time push alerts for low stock, failed
          payments, daily summaries, and security events. Backend activation required.
        </p>
      </div>
    </div>
  )
}
