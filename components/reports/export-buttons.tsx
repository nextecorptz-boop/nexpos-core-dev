'use client'

import { Download } from 'lucide-react'
import { exportToCsv } from '@/lib/export/csv'
import { exportToXlsx } from '@/lib/export/xlsx'

interface ExportButtonsProps {
  salesData: any[]
  lowStockData: any[]
}

export default function ExportButtons({ salesData, lowStockData }: ExportButtonsProps) {
  const handleExportCsv = () => {
    // Basic flat mapping for CSV export
    const flatSales = salesData.map(s => ({
      ID: s.id,
      Date: s.sale_date,
      Status: s.status,
      TotalAmount: s.total_amount
    }))
    exportToCsv(`NEXPOS_Sales_${new Date().toISOString().split('T')[0]}`, flatSales)
  }

  const handleExportXlsx = () => {
    // Advanced flat mapping for Excel
    const flatLowStock = lowStockData.map(i => ({
      SKU: i.sku,
      Product: i.name,
      Brand: i.brand,
      'Current Quantity': i.onHand,
      'Low Stock Threshold': i.threshold
    }))
    exportToXlsx(`NEXPOS_Low_Stock_${new Date().toISOString().split('T')[0]}`, flatLowStock)
  }

  return (
    <div className="flex gap-3">
      <button 
        onClick={handleExportCsv}
        className="bg-nx-surface hover:bg-nx-hover border border-nx-border text-nx-text px-4 py-2 rounded-nx-btn flex items-center text-[13px] font-medium transition-all duration-150 shadow-sm active:scale-[0.97]"
      >
        <Download className="w-4 h-4 mr-2 text-nx-text-sec" />
        Export Sales (CSV)
      </button>
      <button 
        onClick={handleExportXlsx}
        className="bg-nx-surface hover:bg-nx-hover border border-nx-border text-nx-text px-4 py-2 rounded-nx-btn flex items-center text-[13px] font-medium transition-all duration-150 shadow-sm active:scale-[0.97]"
      >
        <Download className="w-4 h-4 mr-2 text-nx-text-sec" />
        Export Low Stock (XLSX)
      </button>
    </div>
  )
}
