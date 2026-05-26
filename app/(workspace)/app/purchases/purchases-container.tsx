'use client'

import React, { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Info, AlertCircle, ShoppingBag } from 'lucide-react'
import { PurchaseBuilder } from '@/components/workspace/purchases/purchase-builder'
import { addToSyncQueue } from '@/lib/sync/sync-engine'
import { useSyncStatus } from '@/lib/sync/use-sync-status'

interface PurchasesContainerProps {
  suppliers: any[]
  products: any[]
  branchId: string
}

export function PurchasesContainer({
  suppliers,
  products,
  branchId
}: PurchasesContainerProps) {
  const searchParams = useSearchParams()
  const isDemoMode = suppliers.length === 0
  const { isOnline } = useSyncStatus()

  // Extract reorder inputs from URL search params (cross-module recommendation links)
  const initialSupplierId = searchParams.get('supplierId') || ''
  const initialVariantId = searchParams.get('variantId') || ''
  const initialQuantity = parseInt(searchParams.get('quantity') || '15')

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Save Draft (draft state)
  const handleSaveDraft = async (supplierId: string, items: any[], notes: string) => {
    setIsSubmitting(true)
    try {
      const payload = {
        supplier_id: supplierId,
        branch_id: branchId,
        total_amount: items.reduce((sum, i) => sum + Number(i.subtotal), 0),
        status: 'draft',
        notes,
        purchase_items: items
      }

      addToSyncQueue('purchase', payload)
      alert(
        isOnline 
          ? 'Draft Purchase Order successfully generated!' 
          : 'Offline Mode: Draft PO saved locally in sync queue.'
      )
    } catch (e) {
      console.error(e)
      alert('Failed to save PO draft.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit PO (Submitted state -> draft status + submitted flag in notes)
  const handleSubmitPO = async (supplierId: string, items: any[], notes: string) => {
    setIsSubmitting(true)
    try {
      const payload = {
        supplier_id: supplierId,
        branch_id: branchId,
        total_amount: items.reduce((sum, i) => sum + Number(i.subtotal), 0),
        status: 'draft',
        notes: JSON.stringify({ notes, submitted: true }),
        purchase_items: items
      }

      addToSyncQueue('purchase', payload)
      alert(
        isOnline 
          ? 'Purchase Order submitted successfully to supplier!' 
          : 'Offline Mode: PO queue registered. It will be sent to supplier when online.'
      )
    } catch (e) {
      console.error(e)
      alert('Failed to submit PO.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Mark Received (Received state -> completed status in database, adding to inventory stock)
  const handleReceivePO = async (supplierId: string, items: any[], notes: string) => {
    setIsSubmitting(true)
    try {
      const payload = {
        supplier_id: supplierId,
        branch_id: branchId,
        total_amount: items.reduce((sum, i) => sum + Number(i.subtotal), 0),
        status: 'completed',
        notes,
        purchase_items: items
      }

      addToSyncQueue('purchase', payload)
      alert(
        isOnline 
          ? 'Purchase Order successfully marked Received! Stock quantities locked and loaded.' 
          : 'Offline Mode: Stock lock scheduled. Inventory levels will update once sync finishes.'
      )
    } catch (e) {
      console.error(e)
      alert('Failed to process PO inventory lock.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Fallback demo data to allow builders to showcase nicely
  const demoSuppliers = isDemoMode 
    ? [
        { id: 'dsup-1', name: 'Kariakoo Footwear Wholesalers' },
        { id: 'dsup-2', name: 'Zanzibar Shoes Distributor' }
      ] 
    : suppliers

  const demoProducts = isDemoMode
    ? [
        {
          id: 'dprod-1',
          name: 'Safari Leather Boots',
          base_cost: 95000,
          variants: [
            { id: 'dvar-1', size: '43', color: 'Brown', sku: 'SAF-BT-BR-43', cost_price: 95000 }
          ]
        },
        {
          id: 'dprod-2',
          name: 'Kariakoo Premium Loafers',
          base_cost: 65000,
          variants: [
            { id: 'dvar-2', size: '42', color: 'Black', sku: 'KAR-LF-BK-42', cost_price: 65000 }
          ]
        }
      ]
    : products

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6 pb-12 flex flex-col gap-6 font-ui">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-nx-cyan/10 border border-nx-cyan/20 rounded-nx-card p-4 flex items-start gap-3 select-none">
          <Info className="w-5 h-5 text-nx-cyan shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[13px] font-bold text-nx-text">Demo Visualization Layer Active</h4>
            <p className="text-[12px] text-nx-text-sec leading-relaxed">
              No suppliers or products exist in the database. NEXPOS is displaying mock inventories for purchase calculations. Populate products to start receiving live stocks.
            </p>
          </div>
        </div>
      )}

      {/* Header Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 shrink-0">
        <div>
          <h1 className="text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Restocking & Purchasing Desk
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Generate draft orders, submit to suppliers, and lock incoming stock
          </p>
        </div>
      </div>

      {/* Core Builder Panel */}
      <PurchaseBuilder
        suppliers={demoSuppliers}
        products={demoProducts}
        initialSupplierId={initialSupplierId}
        initialVariantId={initialVariantId}
        initialQuantity={initialQuantity}
        onSaveDraft={handleSaveDraft}
        onSubmitPO={handleSubmitPO}
        onReceivePO={handleReceivePO}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
