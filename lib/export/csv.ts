export function exportToCsv<T extends Record<string, any>>(filename: string, rows: T[]) {
  if (!rows || !rows.length) {
    return
  }
  
  const separator = ','
  const keys = Object.keys(rows[0])
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows.map(row => {
      return keys.map(k => {
        let cell = row[k] === null || row[k] === undefined ? '' : row[k]
        cell = cell instanceof Date ? cell.toISOString() : cell.toString()
        if (cell.includes(separator) || cell.includes('\n') || cell.includes('"')) {
          cell = `"${cell.replace(/"/g, '""')}"`
        }
        return cell
      }).join(separator)
    }).join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  if (typeof window !== 'undefined') {
    const link = document.createElement('a')
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }
}
