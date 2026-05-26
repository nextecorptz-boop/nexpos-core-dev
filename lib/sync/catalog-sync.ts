import { createClient } from '@/lib/supabase/client'
import { db, type LocalVariant, type LocalCustomer, type LocalSupplier } from './db'

const CHUNK_SIZE = 200
const MAX_VARIANTS = 10000
const MAX_CUSTOMERS = 1000
const STALE_THRESHOLD_DAYS = 14

// Yield CPU control to avoid blocking React main thread
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => resolve())
    } else {
      setTimeout(resolve, 0)
    }
  })
}

// Hydrate the local IndexedDB with branch-scoped catalog data
export async function hydrateCatalog(
  branchId: string,
  tenantId: string,
  onProgress?: (progress: { variants: number; customers: number; status: string }) => void
) {
  const supabase = createClient()
  let variantCount = 0
  let customerCount = 0

  try {
    if (onProgress) onProgress({ variants: 0, customers: 0, status: 'Kuanza kusawazisha (Initializing)...' })

    // --- 1. HYDRATE VARIANTS (BRANCH SCOPED) ---
    // We query from the current_stock view to fetch only variants active in this branch
    let variantOffset = 0
    let hasMoreVariants = true

    // Retrieve last checkpoint variantOffset if any
    const savedCheckpoint = await db.settings.get(`checkpoint_variant_offset_${branchId}`)
    if (savedCheckpoint) {
      variantOffset = Number(savedCheckpoint.value) || 0
    }

    while (hasMoreVariants && variantCount < MAX_VARIANTS) {
      if (onProgress) {
        onProgress({
          variants: variantCount,
          customers: customerCount,
          status: `Kupakua bidhaa (Fetching variants) [Offset: ${variantOffset}]...`
        })
      }

      // Query current_stock to get branch-relevant variant IDs
      const { data: stockItems, error: stockErr } = await supabase
        .from('current_stock')
        .select(`
          variant_id,
          current_quantity
        `)
        .eq('branch_id', branchId)
        .range(variantOffset, variantOffset + CHUNK_SIZE - 1)

      if (stockErr) throw stockErr

      if (!stockItems || stockItems.length === 0) {
        hasMoreVariants = false
        break
      }

      // Extract variant IDs
      const variantIds = stockItems.map((item: any) => item.variant_id)

      // Fetch full variant metadata for the selected IDs
      const { data: variants, error: varErr } = await supabase
        .from('product_variants')
        .select(`
          id,
          family_id,
          sku,
          barcode,
          size,
          color,
          cost_price,
          selling_price,
          is_active,
          low_stock_threshold,
          updated_at,
          product_families (
            name,
            brand,
            gender,
            product_categories (
              name
            )
          )
        `)
        .in('id', variantIds)
        .eq('is_active', true)

      if (varErr) throw varErr

      if (variants && variants.length > 0) {
        // Map variants and append the quantity from current_stock view
        const localVariants: LocalVariant[] = variants.map((v: any) => {
          const stock = stockItems.find((s: any) => s.variant_id === v.id)
          return {
            id: v.id,
            tenant_id: tenantId,
            branch_id: branchId,
            name: `${v.product_families?.name || ''} (${v.color || ''} - Size ${v.size})`,
            sku: v.sku,
            barcode: v.barcode || '',
            price: Number(v.selling_price) || 0,
            cost_price: Number(v.cost_price) || 0,
            quantity: stock ? Number(stock.current_quantity) : 0,
            updated_at: v.updated_at,
            category_name: v.product_families?.product_categories?.name || '',
            brand: v.product_families?.brand || '',
            gender: v.product_families?.gender || ''
          }
        })

        // Save variants chunk to Dexie
        await db.transaction('rw', db.variants, async () => {
          for (const item of localVariants) {
            await db.variants.put(item)
          }
        })

        variantCount += localVariants.length
      }

      variantOffset += CHUNK_SIZE
      // Save progress checkpoint
      await db.settings.put({ key: `checkpoint_variant_offset_${branchId}`, value: variantOffset })

      await yieldToMainThread()

      if (stockItems.length < CHUNK_SIZE) {
        hasMoreVariants = false
      }
    }

    // Clear variant progress checkpoint on completion
    await db.settings.delete(`checkpoint_variant_offset_${branchId}`)

    // --- 2. HYDRATE CUSTOMERS (RECENT/ACTIVE) ---
    let customerOffset = 0
    let hasMoreCustomers = true
    
    // Check checkpoint
    const customerCheckpoint = await db.settings.get(`checkpoint_customer_offset_${branchId}`)
    if (customerCheckpoint) {
      customerOffset = Number(customerCheckpoint.value) || 0
    }

    while (hasMoreCustomers && customerCount < MAX_CUSTOMERS) {
      if (onProgress) {
        onProgress({
          variants: variantCount,
          customers: customerCount,
          status: `Kupakua wateja (Fetching customers) [Offset: ${customerOffset}]...`
        })
      }

      const { data: customers, error: custErr } = await supabase
        .from('customers')
        .select('id, full_name, phone, email, customer_type, credit_limit, notes, updated_at')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .range(customerOffset, customerOffset + CHUNK_SIZE - 1)

      if (custErr) throw custErr

      if (!customers || customers.length === 0) {
        hasMoreCustomers = false
        break
      }

      const localCustomers: LocalCustomer[] = customers.map((c: any) => ({
        id: c.id,
        tenant_id: tenantId,
        name: c.full_name,
        phone: c.phone,
        email: c.email || '',
        customer_type: c.customer_type,
        credit_limit: Number(c.credit_limit) || 0,
        notes: c.notes || '',
        updated_at: c.updated_at
      }))

      await db.transaction('rw', db.customers, async () => {
        for (const cust of localCustomers) {
          await db.customers.put(cust)
        }
      })

      customerCount += localCustomers.length
      customerOffset += CHUNK_SIZE
      await db.settings.put({ key: `checkpoint_customer_offset_${branchId}`, value: customerOffset })

      await yieldToMainThread()

      if (customers.length < CHUNK_SIZE) {
        hasMoreCustomers = false
      }
    }

    // Clear customer checkpoint
    await db.settings.delete(`checkpoint_customer_offset_${branchId}`)

    // --- 3. HYDRATE SUPPLIERS ---
    const { data: suppliers, error: supErr } = await supabase
      .from('suppliers')
      .select('id, name, contact_person, phone, email, address, notes, updated_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    if (supErr) throw supErr

    if (suppliers && suppliers.length > 0) {
      const localSuppliers: LocalSupplier[] = suppliers.map((s: any) => ({
        id: s.id,
        tenant_id: tenantId,
        name: s.name,
        phone: s.phone,
        email: s.email || '',
        updated_at: s.updated_at
      }))

      await db.transaction('rw', db.suppliers, async () => {
        for (const sup of localSuppliers) {
          await db.suppliers.put(sup)
        }
      })
    }

    // --- 4. CLEAN UP STALE CACHE ---
    await purgeStaleCache()

    if (onProgress) {
      onProgress({
        variants: variantCount,
        customers: customerCount,
        status: 'Usawazishaji umekamilika! (Sync completed successfully!)'
      })
    }
  } catch (err: any) {
    console.error('Hydration failed:', err)
    if (onProgress) {
      onProgress({
        variants: variantCount,
        customers: customerCount,
        status: `Hitilafu ya usawazishaji (Sync failure): ${err.message}`
      })
    }
    throw err
  }
}

// Purge records older than threshold that are not modified
async function purgeStaleCache() {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - STALE_THRESHOLD_DAYS)
  const cutoffStr = cutoffDate.toISOString()

  // Purge variants
  await db.variants
    .where('updated_at')
    .below(cutoffStr)
    .delete()

  // Purge customers
  await db.customers
    .where('updated_at')
    .below(cutoffStr)
    .delete()
}

// Fuzzy Offline Search for product variants in IndexedDB
export async function searchVariantsOffline(query: string): Promise<LocalVariant[]> {
  if (!query) {
    return await db.variants.limit(50).toArray()
  }

  const normalized = query.toLowerCase().trim()
  
  // Try exact SKU or barcode match first
  const exactSku = await db.variants.where('sku').equals(normalized).toArray()
  if (exactSku.length > 0) return exactSku

  const exactBarcode = await db.variants.where('barcode').equals(normalized).toArray()
  if (exactBarcode.length > 0) return exactBarcode

  // Fallback to searching token segments in variants name/category/brand
  const tokens = normalized.split(/\s+/)
  
  const allVariants = await db.variants.toArray()
  return allVariants
    .filter((item) => {
      const targetString = `${item.name} ${item.sku} ${item.category_name} ${item.brand}`.toLowerCase()
      return tokens.every((token) => targetString.includes(token))
    })
    .slice(0, 50) // Cap results for rendering performance
}
