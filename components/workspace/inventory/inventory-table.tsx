'use client'

import React, { useRef, useState } from 'react'
import { StockBadge } from './stock-badge'
import { determineInventoryStatus } from '@/lib/domain/risk'
import { ArrowUpDown, Warehouse } from 'lucide-react'

interface InventoryTableProps {
  items: any[]
  onSelectItem: (item: any) => void
}

export function InventoryTable({ items, onSelectItem }: InventoryTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Drag scrolling states
  const [isDown, setIsDown] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  // Sorting states
  const [sortField, setSortField] = useState<string>('stock_left')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const handleMouseDown = (e: React.MouseEvent) => {
    const container = containerRef.current
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
    const container = containerRef.current
    if (!container) return
    const x = e.pageX - container.offsetLeft
    const walk = (x - startX) * 1.5
    container.scrollLeft = scrollLeft - walk
  }

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Sort logic
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
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
  }, [items, sortField, sortDirection])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  return (
    <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden flex flex-col relative select-none">
      <div 
        ref={containerRef}
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
                onClick={() => toggleSort('category_name')}
                className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[120px] cursor-pointer hover:text-nx-cyan select-none"
              >
                <div className="flex items-center gap-1.5">
                  Category <ArrowUpDown className="w-3 h-3" />
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
              <th 
                onClick={() => toggleSort('cost_price')}
                className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[140px] text-right cursor-pointer hover:text-nx-cyan select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  Cost Cost <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th 
                onClick={() => toggleSort('valuation')}
                className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[150px] text-right cursor-pointer hover:text-nx-cyan select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  Valuation <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[180px]">
                Health Badge
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nx-border/50">
            {sortedItems.length > 0 ? (
              sortedItems.map((item) => {
                const health = determineInventoryStatus(
                  Number(item.stock_left),
                  Number(item.low_stock_threshold || 5),
                  Number(item.units_sold || 0)
                )

                return (
                  <tr 
                    key={item.id} 
                    onClick={() => onSelectItem(item)}
                    className="hover:bg-nx-hover/40 transition-colors duration-150 cursor-pointer border-b border-nx-border/50 last:border-0 active:bg-nx-hover"
                  >
                    {/* Sticky product column */}
                    <td className="sticky left-0 bg-nx-surface font-semibold text-[13px] text-nx-cyan px-4 py-3 border-r border-nx-border/30 z-10 truncate max-w-[240px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 font-data text-[12px] text-nx-text-sec truncate max-w-[140px]">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-nx-text-sec">
                      {item.category_name}
                    </td>
                    <td className={`px-4 py-3 font-data text-[12px] text-center font-bold ${
                      Number(item.stock_left) <= Number(item.low_stock_threshold || 5) 
                        ? 'text-nx-red' 
                        : 'text-nx-text'
                    }`}>
                      {item.stock_left}
                    </td>
                    <td className="px-4 py-3 font-data text-[12px] text-nx-text text-right">
                      {formatCurrency(item.cost_price || 0)}
                    </td>
                    <td className="px-4 py-3 font-data text-[12px] font-bold text-nx-text text-right">
                      {formatCurrency(Number(item.stock_left) * Number(item.cost_price || 0))}
                    </td>
                    <td className="px-4 py-3">
                      <StockBadge status={health} />
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[13px] text-nx-text-muted font-ui">
                  <Warehouse className="w-12 h-12 text-nx-text-muted mx-auto mb-3" />
                  No inventory items match filter queries
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
  )
}
