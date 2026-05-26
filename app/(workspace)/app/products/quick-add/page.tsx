'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Save } from 'lucide-react'

interface VariantInput {
  size: string
  color: string
  quantity: number
}

export default function QuickAddPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    category_id: '',
    name: '',
    brand: '',
    gender: 'unisex',
    base_cost: '',
    base_price: '',
    is_public: false,
  })

  const [variants, setVariants] = useState<VariantInput[]>([
    { size: '', color: '', quantity: 0 }
  ])

  useEffect(() => {
    loadCategories()
    loadBranches()
  }, [])

  const loadCategories = async () => {
    const { data } = await supabase
      .from('product_categories')
      .select('*')
      .order('name')
    setCategories(data || [])
  }

  const loadBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setBranches(data || [])
  }

  const addVariantRow = () => {
    setVariants([...variants, { size: '', color: '', quantity: 0 }])
  }

  const removeVariantRow = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index))
  }

  const updateVariant = (index: number, field: string, value: any) => {
    setVariants(variants.map((v, i) => 
      i === index ? { ...v, [field]: value } : v
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create product family
      const { data: family, error: familyError } = await supabase
        .from('product_families')
        .insert({
          ...formData,
          base_cost: parseFloat(formData.base_cost),
          base_price: parseFloat(formData.base_price),
          created_by: user.id,
        })
        .select()
        .single()

      if (familyError) throw familyError

      // Create variants
      const validVariants = variants.filter(v => v.size)
      const variantRecords = validVariants.map(v => ({
        family_id: family.id,
        sku: `${family.name.substring(0, 3).toUpperCase()}-${v.size}-${v.color || 'STD'}`.replace(/\s/g, ''),
        size: v.size,
        color: v.color || null,
        cost_price: parseFloat(formData.base_cost),
        selling_price: parseFloat(formData.base_price),
        is_active: true,
        created_by: user.id,
      }))

      const { data: createdVariants, error: variantsError } = await supabase
        .from('product_variants')
        .insert(variantRecords)
        .select()

      if (variantsError) throw variantsError

      // Create opening stock movements if quantity > 0
      const { data: profile } = await supabase
        .from('profiles')
        .select('branch_id')
        .eq('id', user.id)
        .single()

      const branchId = profile?.branch_id || branches[0]?.id
      if (!branchId) throw new Error('No branch available')

      const stockMovements = validVariants
        .filter(v => v.quantity > 0)
        .map((v, index) => ({
          variant_id: createdVariants[index].id,
          branch_id: branchId,
          movement_type: 'opening_stock',
          quantity: v.quantity,
          notes: 'Initial stock from quick add',
          created_by: user.id,
        }))

      if (stockMovements.length > 0) {
        await supabase.from('inventory_movements').insert(stockMovements)
      }

      router.push('/app/products')
      router.refresh()
    } catch (error: any) {
      console.error('Error creating product:', error)
      alert('Failed to create product: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Link href="/app/products" className="inline-flex items-center gap-2 text-nx-text-sec hover:text-nx-text transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        <span className="font-label uppercase text-sm tracking-wider">Back to Products</span>
      </Link>

      <h1 className="font-display text-5xl font-bold text-nx-text mb-8">Quick Add Product</h1>

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
        {/* Basic Info */}
        <div className="glass-card p-6">
          <h2 className="font-display text-2xl font-bold text-nx-text mb-6">Product Information</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Category *</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
                required
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Product Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
                required
              />
            </div>

            <div>
              <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Brand</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
              />
            </div>

            <div>
              <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Gender *</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
                required
              >
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="kids">Kids</option>
                <option value="unisex">Unisex</option>
              </select>
            </div>

            <div>
              <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Cost Price (TZS) *</label>
              <input
                type="number"
                value={formData.base_cost}
                onChange={(e) => setFormData({ ...formData, base_cost: e.target.value })}
                className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
                required
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Selling Price (TZS) *</label>
              <input
                type="number"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
                required
                min="0"
                step="0.01"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  className="w-5 h-5"
                />
                <span className="text-nx-text">Show in public catalog</span>
              </label>
            </div>
          </div>
        </div>

        {/* Variants */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold text-nx-text">Size & Color Variants</h2>
            <button
              type="button"
              onClick={addVariantRow}
              className="btn-secondary flex items-center gap-2 text-sm py-2"
            >
              <Plus className="w-4 h-4" />
              Add Variant
            </button>
          </div>

          <div className="space-y-3">
            {variants.map((variant, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-3">
                  {index === 0 && <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Size *</label>}
                  <input
                    type="text"
                    value={variant.size}
                    onChange={(e) => updateVariant(index, 'size', e.target.value)}
                    placeholder="e.g. 42"
                    className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
                    required
                  />
                </div>
                <div className="col-span-3">
                  {index === 0 && <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Color</label>}
                  <input
                    type="text"
                    value={variant.color}
                    onChange={(e) => updateVariant(index, 'color', e.target.value)}
                    placeholder="e.g. Black"
                    className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
                  />
                </div>
                <div className="col-span-3">
                  {index === 0 && <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Opening Stock</label>}
                  <input
                    type="number"
                    value={variant.quantity}
                    onChange={(e) => updateVariant(index, 'quantity', parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
                    min="0"
                  />
                </div>
                <div className="col-span-3">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => removeVariantRow(index)}
                      className="w-full btn-secondary py-3"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Saving...' : 'Save Product'}
          </button>
          <Link href="/app/products" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
