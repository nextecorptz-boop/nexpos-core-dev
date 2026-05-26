import * as XLSX from 'xlsx'

const CHUNK_SIZE = 500
const MAX_EXPORT_LIMIT = 50000

export async function generateXlsxReport(
  title: string,
  headers: string[],
  fetchChunk: (offset: number, limit: number) => Promise<any[][]>,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  let offset = 0
  let allRows: any[][] = [headers]
  let hasMore = true

  // Progressive streaming cursors
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

    // Force React UI tick yielding and GC opportunities
    await new Promise((resolve) => setTimeout(resolve, 0))

    if (chunk.length < CHUNK_SIZE) {
      hasMore = false
    }
  }

  // Generate Excel workbook and worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(allRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 30))

  // Write sheet options
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

  // Memory cleanup
  ;(allRows as any) = null

  return blob
}
