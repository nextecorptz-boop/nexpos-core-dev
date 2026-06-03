import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Package } from 'lucide-react'

export default async function ProductsPage() {
  const user = await requireRole(['owner', 'manager'])
  const supabase = await createClient()

  const { data: products } = await supabase
    .from('product_families')
    .select('*, variants:product_variants(count)')
    .eq('is_active', true)
    .order('name')

  const categories = Array.from(new Set((products || []).map(p => p.category).filter(Boolean)))

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-5xl font-bold text-nx-text mb-2">Products</h1>
          <p className="text-nx-text-sec">Manage your product catalog</p>
        </div>
        <div className="flex gap-3">
          <Link href="/app/products/quick-add" className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Quick Add
          </Link>
          <Link href="/app/products/import" className="btn-secondary flex items-center gap-2">
            <Package className="w-5 h-5" />
            Import
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6">
          <p className="text-nx-text-sec font-label uppercase text-xs tracking-wider mb-1">Total Products</p>
          <p className="font-display text-3xl font-bold text-nx-text">{products?.length || 0}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-nx-text-sec font-label uppercase text-xs tracking-wider mb-1">Categories</p>
          <p className="font-display text-3xl font-bold text-nx-text">{categories?.length || 0}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-nx-text-sec font-label uppercase text-xs tracking-wider mb-1">Public Products</p>
          <p className="font-display text-3xl font-bold text-nx-text">
            {products?.filter((p: any) => p.is_public).length || 0}
          </p>
        </div>
      </div>

      {/* Products List */}
      <div className="glass-card p-6">
        <h2 className="font-display text-2xl font-bold text-nx-text mb-6">All Products</h2>
        
        {products && products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-nx-border">
                <tr>
                  <th className="text-left py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Name</th>
                  <th className="text-left py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Category</th>
                  <th className="text-left py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Brand</th>
                  <th className="text-left py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Gender</th>
                  <th className="text-right py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Base Price</th>
                  <th className="text-center py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Variants</th>
                  <th className="text-center py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Public</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product: any) => (
                  <tr key={product.id} className="border-b border-nx-border/50 hover:bg-nx-surface/30 transition-colors">
                    <td className="py-4 px-4 text-nx-text font-medium">{product.name}</td>
                    <td className="py-4 px-4 text-nx-text-sec">{product.category || '-'}</td>
                    <td className="py-4 px-4 text-nx-text-sec">{product.brand || '-'}</td>
                    <td className="py-4 px-4">
                      <span className="inline-block bg-nx-gold/10 text-nx-gold px-3 py-1 text-xs font-label uppercase tracking-wider">
                        {product.gender}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-nx-text font-medium">
                      {new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(product.base_price)}
                    </td>
                    <td className="py-4 px-4 text-center text-nx-text-sec">{product.variants?.length || 0}</td>
                    <td className="py-4 px-4 text-center">
                      {product.is_public ? (
                        <span className="inline-block w-3 h-3 rounded-full bg-nx-gold"></span>
                      ) : (
                        <span className="inline-block w-3 h-3 rounded-full bg-nx-hover"></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-nx-text-sec mx-auto mb-4" />
            <p className="text-nx-text-sec mb-6">No products yet. Add your first product to get started.</p>
            <Link href="/app/products/quick-add" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add First Product
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
