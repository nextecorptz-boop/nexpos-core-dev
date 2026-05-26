'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { Info, AlertCircle, ShoppingBag, Plus, RefreshCw, Layers } from 'lucide-react'
import { InventoryTable } from '@/components/workspace/inventory/inventory-table'
import { RestockPanel } from '@/components/workspace/inventory/restock-panel'
import { FilterBar } from '@/components/workspace/sales/filter-bar'
import { KPICard } from '@/components/workspace/sales/kpi-card'
import { calculateInventoryValuation } from '@/lib/domain/metrics'
import { determineInventoryStatus } from '@/lib/domain/risk'
import { addToSyncQueue } from '@/lib/sync/sync-engine'
import { useSyncStatus } from '@/lib/sync/use-sync-status'

// High-quality mock inventory dataset for demo mode
const DEMO_INVENTORY = [
  {
    id: 'dvar-1',
    name: 'Safari Leather Boots (43 / Brown)',
    sku: 'SAF-BT-BR-43',
    stock_left: 3,
    low_stock_threshold: 5,
    cost_price: 95000,
    category_id: 'cat-1',
    category_name: 'Boots',
    units_sold: 48,
    supplier_id: 'dsup-1',
    supplier_name: 'Kariakoo Footwear Wholesalers',
    supplier_phone: '+255 754 112 233'
  },
  {
    id: 'dvar-2',
    name: 'Kariakoo Premium Loafers (42 / Black)',
    sku: 'KAR-LF-BK-42',
    stock_left: 12,
    low_stock_threshold: 5,
    cost_price: 65000,
    category_id: 'cat-2',
    category_name: 'Formal',
    units_sold: 26,
    supplier_id: 'dsup-2',
    supplier_name: 'Zanzibar Shoes Distributor',
    supplier_phone: '+255 682 990 887'
  },
  {
    id: 'dvar-3',
    name: 'Sports Runner v2 (40 / Navy)',
    sku: 'SPO-RN-BL-40',
    stock_left: 65,
    low_stock_threshold: 10,
    cost_price: 55000,
    category_id: 'cat-3',
    category_name: 'Sport',
    units_sold: 8,
    supplier_id: 'dsup-1',
    supplier_name: 'Kariakoo Footwear Wholesalers',
    supplier_phone: '+255 754 112 233'
  },
  {
    id: 'dvar-4',
    name: 'Classic Oxford Shoes (41 / Brown)',
    sku: 'OXF-SH-BR-41',
    stock_left: 20,
    low_stock_threshold: 5,
    cost_price: 70000,
    category_id: 'cat-2',
    category_name: 'Formal',
    units_sold: 0, // Dead Stock
    supplier_id: 'dsup-2',
    supplier_name: 'Zanzibar Shoes Distributor',
    supplier_phone: '+255 682 990 887'
  },
  {
    id: 'dvar-5',
    name: 'Casual Slip-on Sneakers (39 / White)',
    sku: 'CAS-SL-WH-39',
    stock_left: 80,
    low_stock_threshold: 8,
    cost_price: 35000,
    category_id: 'cat-4',
    category_name: 'Casual',
    units_sold: 2, // Overstocked
    supplier_id: 'dsup-1',
    supplier_name: 'Kariakoo Footwear Wholesalers',
    supplier_phone: '+255 754 112 233'
  }
]

interface InventoryContainerProps {
  initialProducts: any[]
  initialStock: any[]
  initialSaleItems: any[]
  initialCategories: any[]
  initialSuppliers: any[]
  branchId: string
}

export function InventoryContainer({
  initialProducts,
  initialStock,
  initialSaleItems,
  initialCategories,
  initialSuppliers,
  branchId
}: InventoryContainerProps) {
  const isDemoMode = initialProducts.length === 0
  const { isOnline } = useSyncStatus()

  // State Management
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isPOInitiating, setIsPOInitiating] = useState(false)

  // Categories helper mapping
  const categoriesList = useMemo(() => {
    if (isDemoMode) {
      return [
        { id: 'cat-1', name: 'Boots' },
        { id: 'cat-2', name: 'Formal' },
        { id: 'cat-3', name: 'Sport' },
        { id: 'cat-4', name: 'Casual' }
      ]
    }
    return initialCategories.map(c => ({ id: c.id, name: c.name }))
  }, [initialCategories, isDemoMode])

  // Build master inventory data rows
  const inventoryDataset = useMemo(() => {
    if (isDemoMode) return DEMO_INVENTORY

    return initialProducts.flatMap(product => {
      return (product.variants || []).map((variant: any) => {
        // Calculate units sold
        const items = initialSaleItems.filter(i => i.variant_id === variant.id)
        const unitsSold = items.reduce((sum, i) => sum + Number(i.quantity || 0), 0)

        // Find current stock from view records
        const stockRecord = initialStock.find(s => s.variant_id === variant.id)
        const stockLeft = stockRecord ? Number(stockRecord.current_quantity || 0) : 0

        // Find supplier info
        // Choose first active supplier or mock fallback
        const supplier = initialSuppliers[0] || { id: 'default', name: 'Standard Wholesalers', phone: '+255 700 000 000' }

        return {
          id: variant.id,
          name: `${product.name} (${variant.size}${variant.color ? ` / ${variant.color}` : ''})`,
          sku: variant.sku || 'N/A',
          stock_left: stockLeft,
          low_stock_threshold: variant.low_stock_threshold || 5,
          cost_price: Number(variant.cost_price || product.base_cost || 45000),
          category_id: product.category_id,
          category_name: product.category?.name || 'Casual',
          units_sold: unitsSold,
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          supplier_phone: supplier.phone
        }
      })
    })
  }, [initialProducts, initialStock, initialSaleItems, initialSuppliers, isDemoMode])

  // Apply filters
  const filteredInventory = useMemo(() => {
    return inventoryDataset.filter(item => {
      // Category Filter
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false

      // Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        return item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query)
      }

      return true
    })
  }, [inventoryDataset, selectedCategory, searchQuery])

  // Compile Executive KPIs using Domain Calculations
  const kpis = useMemo(() => {
    const totalUnits = filteredInventory.reduce((sum, item) => sum + Number(item.stock_left), 0)
    
    // Domain metric utility invocation
    const valuation = calculateInventoryValuation(filteredInventory.map(item => ({
      current_quantity: item.stock_left,
      variant: { cost_price: item.cost_price }
    })))

    // Count Alerts
    const lowAlerts = filteredInventory.filter(item => {
      const status = determineInventoryStatus(item.stock_left, item.low_stock_threshold, item.units_sold)
      return status === 'low_stock' || status === 'critical'
    }).length

    // Dead Stock valuation
    const deadStockValuation = filteredInventory
      .filter(item => determineInventoryStatus(item.stock_left, item.low_stock_threshold, item.units_sold) === 'dead_stock')
      .reduce((sum, item) => sum + (Number(item.stock_left) * Number(item.cost_price)), 0)

    return {
      totalUnits,
      valuation,
      lowAlerts,
      deadStockValuation
    }
  }, [filteredInventory])

  // Trigger Purchase Order draft generation offline-safe
  const handleInitiatePO = async (supplierId: string, variantId: string, quantity: number) => {
    setIsPOInitiating(true)
    try {
      const poDraftPayload = {
        supplier_id: supplierId,
        branch_id: branchId,
        total_amount: quantity * (selectedItem?.cost_price || 45000),
        status: 'draft',
        notes: `AI Generated draft PO for ${selectedItem?.name}. Reorder advice: ${quantity} units.`,
        purchase_items: [
          {
            variant_id: variantId,
            quantity,
            unit_cost: selectedItem?.cost_price || 45000,
            subtotal: quantity * (selectedItem?.cost_price || 45000),
            received_qty: 0
          }
        ]
      }

      // Add to sync queue
      addToSyncQueue('purchase', poDraftPayload)
      
      alert(
        isOnline 
          ? 'Purchase order draft successfully generated! Navigate to the Purchases page to review and submit.' 
          : 'Offline Mode: Purchase order draft cached locally in sync queue. It will be sent to the server upon connection.'
      )
      setSelectedItem(null)
    } catch (e) {
      console.error(e)
      alert('Failed to generate PO draft.')
    } finally {
      setIsPOInitiating(false)
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6 pb-12 flex flex-col gap-6 font-ui">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-nx-cyan/10 border border-nx-cyan/20 rounded-nx-card p-4 flex items-start gap-3 select-none">
          <Info className="w-5 h-5 text-nx-cyan shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[13px] font-bold text-nx-text">Demo Visualization Layer Active</h4>
            <p className="text-[12px] text-nx-text-sec leading-relaxed">
              No product stock records exist in the database. NEXPOS is displaying mock inventory levels for showcase purposes. Go to the POS terminal or Purchases tab to update stock quantities.
            </p>
          </div>
        </div>
      )}

      {/* Header Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 shrink-0">
        <div>
          <h1 className="text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Warehouse Operations
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Real-time inventory levels, reorder alert panels, and warehouse health scoring
          </p>
        </div>

        <div className="flex gap-2">
          <Link 
            href="/app/purchases" 
            className="bg-nx-cyan hover:bg-nx-cyan/90 text-white px-4 py-2 rounded-nx-btn flex items-center text-[13px] font-medium transition-all duration-150 active:scale-[0.97]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Purchase Order
          </Link>
        </div>
      </div>

      {/* Zone 1 — KPI Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] shrink-0">
        <KPICard 
          title="Total Stock Units"
          value={kpis.totalUnits}
          icon={Layers}
        />
        <KPICard 
          title="Inventory Valuation"
          value={kpis.valuation}
          unit="TZS"
          icon={RefreshCw}
        />
        <KPICard 
          title="Low Stock Alerts"
          value={kpis.lowAlerts}
          icon={AlertCircle}
          delta={kpis.lowAlerts > 0 ? 'Urgent' : 'Healthy'}
          deltaType={kpis.lowAlerts > 0 ? 'down' : 'up'}
        />
        <KPICard 
          title="Dead Stock Value"
          value={kpis.deadStockValuation}
          unit="TZS"
          icon={Info}
        />
      </div>

      {/* Zone 2 — Filter Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={categoriesList}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        placeholder="Search product variant or SKU..."
      />

      {/* Zone 3 — Inventory Table */}
      <div className="flex-grow min-h-0">
        <InventoryTable 
          items={filteredInventory}
          onSelectItem={setSelectedItem}
        />
      </div>

      {/* Restock Recommendation Drawer */}
      <RestockPanel 
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onInitiatePO={handleInitiatePO}
      />
    </div>
  )
}
