import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// Extends jsPDF type definition to include autoTable method
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF
}

const CHUNK_SIZE = 500
const MAX_EXPORT_LIMIT = 50000

export async function generatePdfReport(
  title: string,
  headers: string[],
  fetchChunk: (offset: number, limit: number) => Promise<any[][]>,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const doc = new jsPDF() as jsPDFWithAutoTable
  
  // Set up header info
  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('NEXPOS POINT - ENTERPRISE REPORT', 14, 15)
  
  doc.setFont('Helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Kichwa cha Ripoti (Title): ${title}`, 14, 22)
  doc.text(`Tarehe (Date): ${new Date().toLocaleDateString('en-TZ')}`, 14, 27)
  doc.text('Sarafu (Currency): TZS', 14, 32)
  
  let offset = 0
  let allRows: any[][] = []
  let hasMore = true
  
  // Progressively stream chunks to prevent main memory bloat
  while (hasMore && offset < MAX_EXPORT_LIMIT) {
    const chunk = await fetchChunk(offset, CHUNK_SIZE)
    if (!chunk || chunk.length === 0) {
      hasMore = false
      break
    }
    
    allRows = allRows.concat(chunk)
    offset += CHUNK_SIZE
    
    if (onProgress) {
      onProgress(Math.min(100, Math.round((offset / MAX_EXPORT_LIMIT) * 100)))
    }
    
    // Memory safeguard: Yield control briefly to trigger garbage collection
    await new Promise((resolve) => setTimeout(resolve, 0))
    
    if (chunk.length < CHUNK_SIZE) {
      hasMore = false
    }
  }
  
  // Render table with autotable
  doc.autoTable({
    startY: 38,
    head: [headers],
    body: allRows,
    theme: 'striped',
    headStyles: { fillColor: [6, 182, 212] }, // NEXPOS Cyan matching nx-cyan
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'Helvetica'
    },
    columnStyles: {
      // Force monospace rendering on numerical fields if needed
      0: { font: 'Courier' }, // Often dates or SKUs
      1: { font: 'Courier' }
    }
  })
  
  const blob = doc.output('blob')
  
  // Nullify to assist browser GC
  ;(allRows as any) = null
  
  return blob
}
