'use client'

import { Download } from 'lucide-react'
import { exportToCsv } from '@/lib/export/csv'
import { exportToXlsx } from '@/lib/export/xlsx'

interface ExportButtonsProps {
  salesData: any[]
  inventoryData: any[]
}

export default function ExportButtons({ salesData, inventoryData }: ExportButtonsProps) {
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
    const flatInventory = inventoryData.map(i => ({
      Product: i.name,
      'Current Quantity': i.quantity,
      'Total Cost Value': i.costValue,
      'Total Retail Value': i.retailValue
    }))
    exportToXlsx(`NEXPOS_Inventory_${new Date().toISOString().split('T')[0]}`, flatInventory)
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
        Export Inventory (XLSX)
      </button>
    </div>
  )
}
