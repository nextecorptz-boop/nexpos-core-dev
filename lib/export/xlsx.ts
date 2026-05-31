import * as XLSX from 'xlsx'

export function exportToXlsx<T extends Record<string, any>>(filename: string, rows: T[]) {
  if (!rows || !rows.length) {
    return
  }
  
  if (typeof window !== 'undefined') {
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
    XLSX.writeFile(workbook, `${filename}.xlsx`)
  }
}
