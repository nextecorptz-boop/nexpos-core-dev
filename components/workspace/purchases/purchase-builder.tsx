'use client'

import React, { useState, useMemo } from 'react'
import { ShoppingBag, Search, Plus, Trash2, Calendar, FileText, Check, Save, Send } from 'lucide-react'

interface PurchaseBuilderProps {
  suppliers: any[]
  products: any[] // Families with variants inside
  initialSupplierId?: string
  initialVariantId?: string
  initialQuantity?: number
  onSaveDraft: (supplierId: string, items: any[], notes: string) => Promise<void>
  onSubmitPO: (supplierId: string, items: any[], notes: string) => Promise<void>
  onReceivePO: (supplierId: string, items: any[], notes: string) => Promise<void>
  isSubmitting?: boolean
}

export function PurchaseBuilder({
  suppliers,
  products,
  initialSupplierId = '',
  initialVariantId = '',
  initialQuantity = 15,
  onSaveDraft,
  onSubmitPO,
  onReceivePO,
  isSubmitting = false
}: PurchaseBuilderProps) {
  // PO Builder State
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId)
  const [items, setItems] = useState<any[]>([])
  const [notes, setNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // If initial item was passed, auto-add it once products are loaded
  React.useEffect(() => {
    if (initialVariantId && products.length > 0 && items.length === 0) {
      // Find variant
      let foundVariant: any = null
      let foundProduct: any = null
      for (const p of products) {
        const v = p.variants?.find((v: any) => v.id === initialVariantId)
        if (v) {
          foundVariant = v
          foundProduct = p
          break
        }
      }

      if (foundVariant && foundProduct) {
        setItems([{
          variant_id: foundVariant.id,
          product_name: foundProduct.name,
          sku: foundVariant.sku,
          size: foundVariant.size,
          color: foundVariant.color,
          quantity: initialQuantity,
          unit_cost: Number(foundVariant.cost_price || foundProduct.base_cost || 45000),
          subtotal: initialQuantity * Number(foundVariant.cost_price || foundProduct.base_cost || 45000)
        }])
      }
    }
  }, [initialVariantId, products])

  // Flattened searchable variants list
  const searchableVariants = useMemo(() => {
    const list: any[] = []
    products.forEach(product => {
      (product.variants || []).forEach((variant: any) => {
        list.push({
          id: variant.id,
          name: `${product.name} (Size: ${variant.size}${variant.color ? `, ${variant.color}` : ''})`,
          sku: variant.sku || 'N/A',
          cost_price: Number(variant.cost_price || product.base_cost || 45000),
          product_name: product.name,
          size: variant.size,
          color: variant.color
        })
      })
    })
    return list
  }, [products])

  // Filter searchable variants
  const filteredVariants = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return searchableVariants.filter(v => 
      v.name.toLowerCase().includes(q) || 
      v.sku.toLowerCase().includes(q)
    ).slice(0, 5) // Limit dropdown results to 5
  }, [searchableVariants, searchQuery])

  // Add item to PO
  const handleAddItem = (variant: any) => {
    const existing = items.find(i => i.variant_id === variant.id)
    if (existing) {
      setItems(items.map(i => 
        i.variant_id === variant.id 
          ? { ...i, quantity: i.quantity + 5, subtotal: (i.quantity + 5) * i.unit_cost }
          : i
      ))
    } else {
      setItems([...items, {
        variant_id: variant.id,
        product_name: variant.product_name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        quantity: 10, // Default batch reorder size
        unit_cost: variant.cost_price,
        subtotal: 10 * variant.cost_price
      }])
    }
    setSearchQuery('')
  }

  // Update item field
  const handleUpdateItem = (variantId: string, key: string, val: any) => {
    setItems(items.map(i => {
      if (i.variant_id === variantId) {
        const updated = { ...i, [key]: val }
        updated.subtotal = Number(updated.quantity) * Number(updated.unit_cost)
        return updated
      }
      return i
    }))
  }

  // Remove item
  const handleRemoveItem = (variantId: string) => {
    setItems(items.filter(i => i.variant_id !== variantId))
  }

  // running calculations
  const totals = useMemo(() => {
    const qtySum = items.reduce((sum, i) => sum + Number(i.quantity), 0)
    const costSum = items.reduce((sum, i) => sum + Number(i.subtotal), 0)
    return { quantity: qtySum, cost: costSum }
  }, [items])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  const handleSaveDraft = () => {
    if (!selectedSupplierId) return alert('Select a supplier first.')
    if (items.length === 0) return alert('Add items to purchase.')
    onSaveDraft(selectedSupplierId, items, notes)
  }

  const handleSubmitPO = () => {
    if (!selectedSupplierId) return alert('Select a supplier first.')
    if (items.length === 0) return alert('Add items to purchase.')
    onSubmitPO(selectedSupplierId, items, notes)
  }

  const handleReceivePO = () => {
    if (!selectedSupplierId) return alert('Select a supplier first.')
    if (items.length === 0) return alert('Add items to purchase.')
    onReceivePO(selectedSupplierId, items, notes)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start font-ui select-none">
      {/* Left panel: Builder Workspace */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-6">
        <div className="flex items-center justify-between border-b border-nx-border pb-4">
          <h3 className="font-semibold text-[15px] text-nx-text">Purchase Items</h3>
          <span className="text-[11px] text-nx-text-sec bg-nx-elevated border border-nx-border px-2 py-0.5 rounded font-data">
            {items.length} unique items
          </span>
        </div>

        {/* Product Variant Search and Selector */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-nx-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type product name or SKU to add..."
            className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] pl-10 pr-4 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan transition-colors"
          />
          
          {/* Dropdown list */}
          {filteredVariants.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-nx-surface border border-nx-border rounded-nx-card shadow-lg z-30 overflow-hidden divide-y divide-nx-border/50">
              {filteredVariants.map(v => (
                <div
                  key={v.id}
                  onClick={() => handleAddItem(v)}
                  className="px-4 py-3 hover:bg-nx-hover/50 cursor-pointer flex justify-between items-center text-[13px] transition-colors"
                >
                  <div>
                    <p className="font-semibold text-nx-text">{v.name}</p>
                    <p className="font-data text-[11px] text-nx-text-sec mt-0.5">{v.sku}</p>
                  </div>
                  <span className="font-data text-[12px] text-nx-cyan font-bold">
                    {formatCurrency(v.cost_price)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Items List */}
        <div className="border border-nx-border rounded-nx-card overflow-hidden">
          <div className="bg-nx-elevated px-4 py-2 border-b border-nx-border grid grid-cols-[1fr_80px_120px_100px_40px] text-[11px] font-semibold text-nx-text-sec">
            <span>Product Variant</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Unit Cost</span>
            <span className="text-right">Subtotal</span>
            <span className="text-center"></span>
          </div>

          <div className="divide-y divide-nx-border/50 min-h-[160px] max-h-[300px] overflow-y-auto">
            {items.length > 0 ? (
              items.map((item) => (
                <div key={item.variant_id} className="px-4 py-3 grid grid-cols-[1fr_80px_120px_100px_40px] items-center text-[13px]">
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-nx-text truncate">{item.product_name}</p>
                    <p className="text-[11px] text-nx-text-sec flex gap-1 mt-0.5">
                      {item.size && <span>Size: {item.size}</span>}
                      {item.color && <span>· Color: {item.color}</span>}
                    </p>
                  </div>
                  
                  {/* Quantity Stepper */}
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleUpdateItem(item.variant_id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 bg-nx-elevated border border-nx-border text-center font-data text-[12px] py-1 rounded focus:outline-none focus:border-nx-cyan"
                  />
                  
                  {/* Unit Cost Override Input */}
                  <div className="text-right pr-2">
                    <input
                      type="number"
                      value={item.unit_cost}
                      onChange={(e) => handleUpdateItem(item.variant_id, 'unit_cost', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-24 bg-nx-elevated border border-nx-border text-right font-data text-[12px] py-1 px-2 rounded focus:outline-none focus:border-nx-cyan"
                    />
                  </div>

                  {/* Item Subtotal */}
                  <span className="font-data text-[12px] text-right font-semibold text-nx-text">
                    {formatCurrency(item.subtotal)}
                  </span>

                  {/* Delete row */}
                  <button
                    onClick={() => handleRemoveItem(item.variant_id)}
                    className="text-nx-text-muted hover:text-nx-red p-1 rounded-nx-xs flex items-center justify-center transition-colors mx-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-nx-text-muted text-[13px] flex flex-col items-center justify-center gap-2">
                <ShoppingBag className="w-10 h-10 text-nx-text-muted/60" />
                <span>Builder is empty. Search products above.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right panel: Summary & Supplier contexts */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-6">
        <h3 className="font-semibold text-[15px] text-nx-text border-b border-nx-border pb-4">PO Summary</h3>
        
        {/* Supplier Selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Supplier</label>
          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2.5 rounded-nx-btn focus:outline-none focus:border-nx-cyan transition-colors"
          >
            <option value="">Select Supplier...</option>
            {suppliers.map(sup => (
              <option key={sup.id} value={sup.id}>
                {sup.name}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Delivery terms, notes..."
            rows={3}
            className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] p-3 rounded-nx-btn focus:outline-none focus:border-nx-cyan transition-colors resize-none"
          />
        </div>

        {/* Totals panel */}
        <div className="bg-nx-elevated/50 p-4 border border-nx-border rounded-nx-card space-y-3 text-[13px]">
          <div className="flex justify-between">
            <span className="text-nx-text-sec">Total Stock Units</span>
            <span className="font-data font-semibold text-nx-text">{totals.quantity}</span>
          </div>
          <div className="border-t border-nx-border pt-3 flex justify-between items-baseline font-bold text-[14px]">
            <span className="text-nx-text">Estimated Total</span>
            <span className="font-data text-nx-cyan text-[16px]">{formatCurrency(totals.cost)}</span>
          </div>
        </div>

        {/* Action gates */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="w-full bg-nx-surface hover:bg-nx-hover border border-nx-border text-nx-text font-semibold text-[12px] py-2.5 rounded-nx-btn flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Save PO Draft</span>
          </button>
          
          <button
            onClick={handleSubmitPO}
            disabled={isSubmitting}
            className="w-full bg-nx-elevated border border-nx-border text-nx-cyan hover:bg-nx-cyan hover:text-white hover:border-nx-cyan font-semibold text-[12px] py-2.5 rounded-nx-btn flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Submit to Supplier</span>
          </button>

          <button
            onClick={handleReceivePO}
            disabled={isSubmitting}
            className="w-full bg-nx-cyan hover:bg-nx-cyan/90 text-white font-bold text-[12px] py-3 rounded-nx-btn flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50 shadow-sm"
          >
            <Check className="w-4.5 h-4.5" />
            <span>Mark PO Received (Lock Stock)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
