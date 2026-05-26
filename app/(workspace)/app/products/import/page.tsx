import { requireRole } from '@/lib/auth/session'
import Link from 'next/link'
import { Upload, FileText, AlertCircle } from 'lucide-react'

export default async function ProductImportPage() {
  await requireRole(['owner', 'manager'])

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-5xl font-bold text-nx-text mb-2">Import Products</h1>
        <p className="text-nx-text-sec">Bulk import products via CSV</p>
      </div>

      <div className="glass-card p-12 text-center">
        <Upload className="w-16 h-16 text-nx-text-sec mx-auto mb-6" />
        <h2 className="font-display text-3xl font-bold text-nx-text mb-4">CSV Import</h2>
        <p className="text-nx-text-sec mb-8 max-w-2xl mx-auto">
          Import functionality is under development. For now, please use the Quick Add feature to add products individually.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/app/products/quick-add" className="btn-primary">
            Use Quick Add
          </Link>
          <Link href="/app/products" className="btn-secondary">
            Back to Products
          </Link>
        </div>
      </div>

      <div className="glass-card p-6 mt-8 border-l-4 border-nx-gold">
        <div className="flex gap-4">
          <FileText className="w-6 h-6 text-nx-gold flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-display text-xl font-bold text-nx-text mb-2">Expected CSV Format</h3>
            <p className="text-nx-text-sec mb-4">
              When import is available, your CSV should include these columns:
            </p>
            <div className="bg-nx-surface p-4 font-mono text-sm text-nx-text">
              category,name,brand,gender,cost_price,selling_price,size,color,opening_stock
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
