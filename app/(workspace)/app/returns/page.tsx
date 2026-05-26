import { requireAuth } from '@/lib/auth/session'
import { RotateCcw } from 'lucide-react'

export default async function ReturnsPage() {
  await requireAuth()

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-5xl font-bold text-nx-text mb-2">Returns</h1>
        <p className="text-nx-text-sec">Process product returns and refunds</p>
      </div>

      <div className="glass-card p-12 text-center">
        <RotateCcw className="w-16 h-16 text-nx-text-sec mx-auto mb-6" />
        <h2 className="font-display text-3xl font-bold text-nx-text mb-4">Returns Processing</h2>
        <p className="text-nx-text-sec max-w-2xl mx-auto">
          This module is under development. It will allow you to process returns, issue refunds, and update inventory accordingly.
        </p>
      </div>
    </div>
  )
}
