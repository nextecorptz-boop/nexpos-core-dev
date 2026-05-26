import { requireRole } from '@/lib/auth/session'
import { TrendingUp } from 'lucide-react'

export default async function ReportsPage() {
  await requireRole(['owner', 'manager'])

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-5xl font-bold text-nx-text mb-2">Reports</h1>
        <p className="text-nx-text-sec">Business analytics and insights</p>
      </div>

      <div className="glass-card p-12 text-center">
        <TrendingUp className="w-16 h-16 text-nx-text-sec mx-auto mb-6" />
        <h2 className="font-display text-3xl font-bold text-nx-text mb-4">Reports & Analytics</h2>
        <p className="text-nx-text-sec max-w-2xl mx-auto">
          Comprehensive reporting features are under development. This will include sales reports, inventory reports, profit analysis, and more.
        </p>
      </div>
    </div>
  )
}
