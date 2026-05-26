'use client'

import React, { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Info, ArrowUpDown, ShieldAlert, BadgeInfo } from 'lucide-react'
import { FilterBar } from '@/components/workspace/sales/filter-bar'
import { PerformanceIndicator, VelocityType, RiskType } from '@/components/workspace/sales/performance-indicator'

// Mock visualization dataset for demo mode (empty DB)
const DEMO_ITEMS = [
  {
    id: 'dprod-1',
    name: 'Safari Leather Boots',
    sku: 'SAF-BT-BR-43',
    units_sold: 48,
    revenue: 4560000,
    margin: 45,
    stock_left: 3,
    low_stock_threshold: 5,
    category_id: 'cat-1',
    category_name: 'Boots'
  },
  {
    id: 'dprod-2',
    name: 'Kariakoo Premium Loafers',
    sku: 'KAR-LF-BK-42',
    units_sold: 26,
    revenue: 2210000,
    margin: 48,
    stock_left: 12,
    low_stock_threshold: 5,
    category_id: 'cat-2',
    category_name: 'Formal'
  },
  {
    id: 'dprod-3',
    name: 'Sports Runner v2',
    sku: 'SPO-RN-BL-40',
    units_sold: 8,
    revenue: 440000,
    margin: 38,
    stock_left: 65,
    low_stock_threshold: 10,
    category_id: 'cat-3',
    category_name: 'Sport'
  },
  {
    id: 'dprod-4',
    name: 'Classic Oxford Shoes',
    sku: 'OXF-SH-BR-41',
    units_sold: 0,
    revenue: 0,
    margin: 0,
    stock_left: 20,
    low_stock_threshold: 5,
    category_id: 'cat-2',
    category_name: 'Formal'
  },
  {
    id: 'dprod-5',
    name: 'Casual Slip-on Sneakers',
    sku: 'CAS-SL-WH-39',
    units_sold: 2,
    revenue: 100000,
    margin: 50,
    stock_left: 80,
    low_stock_threshold: 8,
    category_id: 'cat-4',
    category_name: 'Casual'
  }
]

interface ItemsIntelligenceContainerProps {
  initialProducts: any[]
  initialSaleItems: any[]
  initialStock: any[]
  initialCategories: any[]
}

export function ItemsIntelligenceContainer({
  initialProducts,
  initialSaleItems,
  initialStock,
  initialCategories
}: ItemsIntelligenceContainerProps) {
  const isDemoMode = initialProducts.length === 0

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [timeRange, setTimeRange] = useState('7d')

  // Sorting State
  const [sortField, setSortField] = useState<string>('units_sold')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Drag Scroll States for tablet
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [isDown, setIsDown] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    const container = tableContainerRef.current
    if (!container) return
    setIsDown(true)
    setStartX(e.pageX - container.offsetLeft)
    setScrollLeft(container.scrollLeft)
  }

  const handleMouseLeave = () => {
    setIsDown(false)
  }

  const handleMouseUp = () => {
    setIsDown(false)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown) return
    e.preventDefault()
    const container = tableContainerRef.current
    if (!container) return
    const x = e.pageX - container.offsetLeft
    const walk = (x - startX) * 1.5
    container.scrollLeft = scrollLeft - walk
  }

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

  // Build items intelligence rows dynamically
  const itemsData = useMemo(() => {
    if (isDemoMode) return DEMO_ITEMS

    // Compile from live database records
    return initialProducts.flatMap(product => {
      return (product.variants || []).map((variant: any) => {
        // Calculate units sold & revenue
        const items = initialSaleItems.filter(i => i.variant_id === variant.id)
        
        const unitsSold = items.reduce((sum, i) => sum + Number(i.quantity || 0), 0)
        const revenue = items.reduce((sum, i) => sum + Number(i.subtotal || 0), 0)
        const totalCost = items.reduce((sum, i) => sum + (Number(i.cost_price || 0) * Number(i.quantity || 0)), 0)
        
        const margin = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0

        // Find current stock from view
        const stockRecord = initialStock.find(s => s.variant_id === variant.id)
        const stockLeft = stockRecord ? Number(stockRecord.current_quantity || 0) : 0

        return {
          id: variant.id,
          name: `${product.name} (${variant.size}${variant.color ? ` / ${variant.color}` : ''})`,
          sku: variant.sku || 'N/A',
          units_sold: unitsSold,
          revenue,
          margin: Math.round(margin),
          stock_left: stockLeft,
          low_stock_threshold: variant.low_stock_threshold || 5,
          category_id: product.category_id,
          category_name: product.category?.name || 'Casual'
        }
      })
    })
  }, [initialProducts, initialSaleItems, initialStock, isDemoMode])

  // Apply filters (Search, Category)
  const filteredItems = useMemo(() => {
    return itemsData.filter(item => {
      // Category Filter
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false

      // Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchName = item.name.toLowerCase().includes(query)
        const matchSku = item.sku.toLowerCase().includes(query)
        return matchName || matchSku
      }

      return true
    })
  }, [itemsData, selectedCategory, searchQuery])

  // Apply Sorting
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a: any, b: any) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredItems, sortField, sortDirection])

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Helper functions for decision support rules
  const getVelocityRating = (unitsSold: number): VelocityType => {
    if (unitsSold >= 20) return 'high'
    if (unitsSold >= 5) return 'moderate'
    return 'slow'
  }

  const getInventoryRisk = (unitsSold: number, stockLeft: number, threshold: number): RiskType => {
    if (stockLeft <= threshold) return 'low_stock'
    if (unitsSold === 0) return 'dead_stock'
    if (unitsSold >= 20) return 'fast_moving'
    if (stockLeft > 50 && unitsSold < 3) return 'overstocked'
    return 'normal'
  }

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
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
              No products or variants exist in the database. NEXPOS is displaying mock inventory movement intelligence for showcase purposes. Add products and record sales to build automated decision support cards.
            </p>
          </div>
        </div>
      )}

      {/* Header Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 shrink-0">
        <div>
          <h1 className="text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Item Intelligence
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Product performance, velocity metrics, and stock risk detection
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={categoriesList}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        placeholder="Search product or SKU..."
      />

      {/* Zone 2 — Performance Table */}
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden flex flex-col relative select-none">
        {/* Table Container */}
        <div 
          ref={tableContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`overflow-x-auto no-scrollbar cursor-grab ${isDown ? 'cursor-grabbing' : ''}`}
        >
          <table className="w-full border-collapse text-left min-w-[960px] table-layout-fixed">
            <thead>
              <tr className="bg-nx-elevated/70 border-b border-nx-border">
                {/* Sticky product column */}
                <th 
                  onClick={() => toggleSort('name')}
                  className="sticky left-0 bg-nx-elevated/90 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-20 w-[240px] cursor-pointer hover:text-nx-cyan shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] select-none"
                >
                  <div className="flex items-center gap-1.5">
                    Product <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('sku')}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[140px] cursor-pointer hover:text-nx-cyan select-none"
                >
                  <div className="flex items-center gap-1.5">
                    SKU <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('units_sold')}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[120px] text-center cursor-pointer hover:text-nx-cyan select-none"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    Units Sold <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('revenue')}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[150px] text-right cursor-pointer hover:text-nx-cyan select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Revenue <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('margin')}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[120px] text-center cursor-pointer hover:text-nx-cyan select-none"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    Margin % <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  onClick={() => toggleSort('stock_left')}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[120px] text-center cursor-pointer hover:text-nx-cyan select-none"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    Stock Left <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[300px]">
                  Performance Indicators
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-border/50">
              {sortedItems.length > 0 ? (
                sortedItems.map((item: any) => {
                  const vel = getVelocityRating(item.units_sold)
                  const risk = getInventoryRisk(item.units_sold, item.stock_left, item.low_stock_threshold)

                  return (
                    <tr 
                      key={item.id} 
                      className="hover:bg-nx-hover/40 transition-colors duration-150 border-b border-nx-border/50 last:border-0"
                    >
                      {/* Sticky product column */}
                      <td className="sticky left-0 bg-nx-surface font-semibold text-[13px] text-nx-text px-4 py-3 border-r border-nx-border/30 z-10 truncate max-w-[240px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 font-data text-[12px] text-nx-text-sec truncate max-w-[140px]">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3 font-data text-[12px] font-bold text-nx-text text-center">
                        {item.units_sold}
                      </td>
                      <td className="px-4 py-3 font-data text-[12px] font-bold text-nx-text text-right">
                        {formatCurrency(item.revenue)}
                      </td>
                      <td className="px-4 py-3 font-data text-[12px] font-semibold text-center text-nx-text-sec">
                        {item.units_sold > 0 ? `${item.margin}%` : '0%'}
                      </td>
                      <td className={`px-4 py-3 font-data text-[12px] text-center font-bold ${item.stock_left <= item.low_stock_threshold ? 'text-nx-red' : 'text-nx-text'}`}>
                        {item.stock_left}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {/* Velocity badge */}
                          <PerformanceIndicator type="velocity" value={vel} />
                          {/* Risk indicator */}
                          <PerformanceIndicator type="risk" value={risk} />
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[13px] text-nx-text-muted font-ui">
                    No items match current filter criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Compact Table styles */}
        <style jsx global>{`
          @media (max-width: 1024px) {
            table th, table td {
              padding-top: 0.5rem !important;
              padding-bottom: 0.5rem !important;
              padding-left: 0.75rem !important;
              padding-right: 0.75rem !important;
              font-size: 12px !important;
            }
          }
        `}</style>
      </div>

      {/* Decision Support Guidelines Summary Drawer */}
      <div className="bg-nx-elevated/40 border border-nx-border rounded-nx-card p-4 flex items-start gap-3">
        <BadgeInfo className="w-5 h-5 text-nx-cyan shrink-0 mt-0.5" />
        <div className="text-[12px] text-nx-text-sec leading-relaxed">
          <h4 className="font-bold text-nx-text text-[13px] mb-1">How Inventory Risk Signals Work</h4>
          <ul className="list-disc pl-4 space-y-1 mt-1 text-[11px] md:text-[12px]">
            <li><span className="font-bold text-nx-red">Low Stock:</span> Current inventory quantity is at or below the variant's warning threshold. Reorder immediately.</li>
            <li><span className="font-bold text-nx-cyan">Fast Moving:</span> Velocity metrics report high units sold. Prioritize shelf exposure.</li>
            <li><span className="font-bold text-nx-orange">Overstocked:</span> High local stock count with low historical sales volume. Consider discounting or marketing pushes.</li>
            <li><span className="font-bold text-nx-text-muted">Dead Stock:</span> Zero units sold since introduction. Review stock allocation.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
