import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { OrdersContainer } from './orders-container'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const user = await requireRole(['owner', 'manager', 'cashier'])
  const supabase = await createClient()

  // Query sales with client joins
  // RLS filters the sales to the user's tenant (and branch for cashiers/managers) automatically
  const { data: sales } = await supabase
    .from('sales')
    .select(`
      id,
      receipt_number,
      sale_date,
      total_amount,
      subtotal,
      discount_amount,
      amount_paid,
      balance_due,
      status,
      customer:customers(full_name, phone, notes),
      cashier:profiles!sales_cashier_id_fkey(full_name, role),
      payments(payment_method, amount, reference_code),
      sale_items(
        id,
        quantity,
        unit_price,
        subtotal,
        variant:product_variants(
          id,
          size,
          color,
          family:product_families(id, name)
        )
      )
    `)
    .order('sale_date', { ascending: false })

  return (
    <OrdersContainer 
      initialSales={sales || []} 
      userRole={user.role} 
    />
  )
}
