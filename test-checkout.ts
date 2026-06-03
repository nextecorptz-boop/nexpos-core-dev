import { createClient } from '@supabase/supabase-js'
import { ulid } from 'ulid'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const targetEmail = process.argv[2] || 'manager@nexpos.dev'

async function runTest() {
  console.log(`Logging in as ${targetEmail}...`)
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: 'password123'
  })

  if (authErr || !authData.session) {
    console.error('Auth failed:', authErr)
    process.exit(1)
  }

  console.log('Fetching manager profile...')
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('branch_id, tenant_id')
    .eq('id', authData.user.id)
    .single()

  if (profErr || !profile) {
    console.error('Failed to get profile:', profErr)
    process.exit(1)
  }

  const branchId = profile.branch_id
  console.log('Branch ID:', branchId, 'Tenant:', profile.tenant_id)

  console.log('Fetching a product variant with stock...')
  const { data: stockLevels, error: stockErr } = await supabase
    .from('stock_levels')
    .select('variant_id, on_hand')
    .eq('branch_id', branchId)
    .gt('on_hand', 0)
    .limit(1)

  if (stockErr || !stockLevels || stockLevels.length === 0) {
    console.error('No stock available for test:', stockErr, stockLevels)
    process.exit(1)
  }

  const variantId = stockLevels[0].variant_id
  const initialStock = stockLevels[0].on_hand
  console.log(`Selected variant ${variantId} with stock ${initialStock}`)

  const clientId = ulid()
  const payload = {
    client_id: clientId,
    branch_id: branchId,
    customer_id: null,
    payment_method: 'cash',
    payment_meta: { amount_tendered: 50000 },
    discount_amount: 0,
    lines: [
      {
        variant_id: variantId,
        quantity: 1,
        unit_price: 45000,
        line_discount: 0
      }
    ]
  }

  console.log('Calling complete_sale RPC...')
  const { data: saleData, error: saleErr } = await supabase.rpc('complete_sale', { p_input: payload })

  if (saleErr) {
    console.error('Sale failed:', saleErr)
    process.exit(1)
  }

  console.log('Sale succeeded!', saleData)

  const saleId = saleData.sale_id

  console.log('Checking database effects...')
  
  const { data: saleRow } = await supabase.from('sales').select('*').eq('id', saleId).single()
  console.log('Sale Row:', !!saleRow)

  const { data: saleLines } = await supabase.from('sale_lines').select('*').eq('sale_id', saleId)
  console.log('Sale Lines Count:', saleLines?.length)

  const { data: newStock } = await supabase.from('stock_levels').select('on_hand').eq('branch_id', branchId).eq('variant_id', variantId).single()
  console.log(`New Stock: ${newStock?.on_hand} (Expected: ${initialStock - 1})`)

  const { data: movements } = await supabase.from('stock_movements').select('*').eq('reference_id', saleId)
  console.log('Stock Movements Count:', movements?.length)

  console.log('Testing Idempotency (re-submitting same client_id)...')
  const { data: replayData, error: replayErr } = await supabase.rpc('complete_sale', { p_input: payload })
  
  if (replayErr) {
    console.error('Replay failed unexpectedly:', replayErr)
  } else {
    console.log('Replay Result (should have replayed: true):', replayData)
  }

  console.log('Done.')
}

runTest()
