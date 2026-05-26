export interface Sale {
  status: string
  balance_due?: number | string
  [key: string]: any
}

export function getOperationalStatus(sale: Sale): 'cancelled' | 'completed' | 'pending' | 'processing' {
  if (sale.status === 'cancelled') return 'cancelled'
  if (sale.status === 'completed') return 'completed'
  
  const balanceDue = typeof sale.balance_due === 'string' 
    ? parseFloat(sale.balance_due) 
    : sale.balance_due || 0

  if (balanceDue > 0 || sale.status === 'partial') return 'pending'
  return 'processing'
}
