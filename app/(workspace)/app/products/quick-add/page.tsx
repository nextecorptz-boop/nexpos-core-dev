import { requireRole } from '@/lib/auth/session'
import { AlertTriangle, LockKeyhole, ScanBarcode } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function QuickAddPage() {
  await requireRole(['owner', 'manager'])

  return (
    <div className="max-w-[1400px] mx-auto px-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pt-6 select-none">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ScanBarcode className="w-5 h-5 text-nx-text-sec" />
            <h1 className="font-ui text-[22px] font-bold text-nx-text leading-[1.3]">
              Quick Add Product
            </h1>
          </div>
          <p className="text-nx-text-sec text-[12px]">
            Rapidly onboard new products and variants to the catalogue
          </p>
        </div>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-3 bg-nx-amber/5 border border-nx-amber/20 rounded-nx-card px-5 py-4 mb-6 select-none">
        <AlertTriangle className="w-5 h-5 text-nx-amber flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-ui text-[13px] font-semibold text-nx-amber mb-0.5">
            Product write access requires backend activation
          </p>
          <p className="text-[12px] text-nx-text-muted leading-relaxed">
            The Quick Add flow creates new product families and variants with pricing and stock
            configuration. The form below shows the expected fields — saving is disabled until the
            write action is activated.
          </p>
        </div>
      </div>

      {/* Disabled quick-add form */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5">
        <h3 className="font-ui text-[13px] font-semibold text-nx-text mb-5">
          Product Details
        </h3>
        <div className="grid md:grid-cols-2 gap-4 mb-5 opacity-60 pointer-events-none select-none">
          {[
            { label: 'Product Name', span: 2 },
            { label: 'Brand / Supplier' },
            { label: 'Category' },
            { label: 'Base Price (TZS)' },
            { label: 'Cost Price (TZS)' },
            { label: 'SKU / Barcode' },
            { label: 'Initial Stock' },
          ].map(({ label, span }) => (
            <div key={label} className={span === 2 ? 'md:col-span-2' : ''}>
              <label className="block text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
                {label}
              </label>
              <div className="w-full bg-nx-elevated border border-nx-border rounded-nx-btn px-3 py-2 h-9" />
            </div>
          ))}
        </div>

        <div className="mb-5 opacity-60 pointer-events-none select-none">
          <label className="block text-[11px] font-bold text-nx-text-sec uppercase tracking-wider mb-1.5">
            Variants (Size / Color)
          </label>
          <div className="bg-nx-elevated border border-nx-border border-dashed rounded-nx-card p-6 flex items-center justify-center">
            <p className="text-[12px] text-nx-text-muted">+ Add variant</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-nx-border/50 select-none">
          <LockKeyhole className="w-4 h-4 text-nx-text-muted flex-shrink-0" />
          <p className="text-[12px] text-nx-text-muted">
            Product creation requires backend write activation.
          </p>
          <button
            disabled
            aria-disabled="true"
            className="ml-auto bg-nx-elevated border border-nx-border text-nx-text-muted px-6 py-2 rounded-nx-btn text-[13px] font-medium cursor-not-allowed opacity-60"
          >
            Save Product
          </button>
        </div>
      </div>
    </div>
  )
}
