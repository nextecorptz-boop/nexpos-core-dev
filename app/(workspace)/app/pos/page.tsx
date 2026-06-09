'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Wifi, WifiOff } from 'lucide-react'
import { CategoryBar, Category } from '@/components/workspace/pos/category-bar'
import { ProductCard, Product } from '@/components/workspace/pos/product-card'
import { VariantPanel } from '@/components/workspace/pos/variant-panel'
import { OrderPanel } from '@/components/workspace/pos/order-panel'
import { PaymentPanel } from '@/components/workspace/pos/payment-panel'
import { SuccessState } from '@/components/workspace/pos/success-state'
import { addToSyncQueue } from '@/lib/sync/sync-engine'
import { db } from '@/lib/sync/db'
import { ulid } from 'ulid'
import { toast } from 'sonner'

interface CartItem {
  variant_id: string
  product_name: string
  size: string
  color: string | null
  quantity: number
  unit_price: number
  cost_price: number
  max_available: number // Checked at checkout
}

type CheckoutState = 'cart' | 'payment' | 'success'

export default function POSPage() {
  const supabase = createClient()
  
  // System State
  const [isOnline, setIsOnline] = useState(true)
  const [activeBranchId, setActiveBranchId] = useState<string>('')
  const [activeTenantId, setActiveTenantId] = useState<string>('')
  const [cashSessionId, setCashSessionId] = useState<string>('')
  const [cashierId, setCashierId] = useState<string>('')
  const [branchPrefix, setBranchPrefix] = useState<string>('NEXPOS')

  // Data State
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Interaction State
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('cart')

  // Language state — reads nx-lang set by the workspace nav toggle
  const [lang, setLang] = useState<'en' | 'sw'>('en')

  useEffect(() => {
    const stored = localStorage.getItem('nx-lang') as 'en' | 'sw' | null
    if (stored === 'sw') setLang('sw')
    const handleLangChange = () => {
      const updated = localStorage.getItem('nx-lang') as 'en' | 'sw' | null
      setLang(updated === 'sw' ? 'sw' : 'en')
    }
    window.addEventListener('nx-lang-change', handleLangChange)
    return () => window.removeEventListener('nx-lang-change', handleLangChange)
  }, [])

  // Convenience translator for POS copy
  const pos = {
    title:       lang === 'sw' ? 'Kituo cha Mauzo' : 'Point of Sale',
    sessionActive: lang === 'sw' ? 'Inayofanya kazi' : 'Active',
    sessionNone:   lang === 'sw' ? 'Hakuna Zamu' : 'No active shift',
    online:      lang === 'sw' ? 'Mtandao Upo (Online)' : 'Online',
    offline:     lang === 'sw' ? 'Nje ya Mtandao (Offline)' : 'Offline',
    loading:     lang === 'sw' ? 'Kupakia bidhaa...' : 'Loading products...',
    noProducts:  lang === 'sw' ? 'Hakuna bidhaa iliyopatikana.' : 'No products found.',
    searchPlaceholder: lang === 'sw' ? 'Tafuta bidhaa kwa jina au SKU...' : 'Search item, SKU, barcode, or service…',
    stockOut:    (max: number) =>
      lang === 'sw'
        ? `Bidhaa imekwisha! Unaweza kuongeza hadi ${max} pekee.`
        : `Out of stock — maximum ${max} available.`,
    overStock:   (max: number) =>
      lang === 'sw'
        ? `Huwezi kuongeza zaidi ya kiwango cha akiba (${max} available)`
        : `Cannot exceed available stock (${max} units).`,
    paySuccess:  (receipt: string) =>
      lang === 'sw'
        ? `Malipo yamepokelewa! Stakabadhi: ${receipt}`
        : `Payment received! Receipt: ${receipt}`,
    payFail:     lang === 'sw' ? 'Malipo yameshindwa kuhifadhiwa' : 'Payment could not be saved.',
    loadFail:    lang === 'sw'
      ? 'Imeshindwa kupakia orodha ya bidhaa (Failed loading catalog)'
      : 'Failed to load product catalog.',
  }

  // Listen to online status
  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 1. Fetch Auth & Profile details
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setCashierId(session.user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('branch_id, tenant_id, branches(name)')
          .eq('id', session.user.id)
          .single()
        
        if (profile) {
          setActiveBranchId(profile.branch_id || '')
          setActiveTenantId(profile.tenant_id || '')
          if (profile.branches && typeof (profile.branches as any).name === 'string') {
            const name = (profile.branches as any).name
            setBranchPrefix(name.slice(0, 4).toUpperCase())
          }

          // Fetch active cash session (Stubbed to safe default)
          setCashSessionId('default-session')
        }
      }
    }
    fetchProfile()
  }, [])

  // 2. Fetch Catalog (Variants + Stock + Reservations)
  const fetchCatalogData = async () => {
    if (!activeBranchId || !activeTenantId) return

    setLoading(true)
    try {
      if (isOnline) {
        // --- ONLINE: Fetch product families, variants, and stock from Supabase ---
        const { data: prods } = await supabase
          .from('product_families')
          .select('id, name, brand, category')
          .eq('is_active', true)

        const { data: variants } = await supabase
          .from('product_variants')
          .select('*')
          .eq('is_active', true)

        const { data: stocks } = await supabase
          .from('stock_levels')
          .select('variant_id, on_hand')
          .eq('branch_id', activeBranchId)

        if (prods && variants) {
          // Map availability onto variants
          const mappedVariants = variants.map((v: any) => {
            const stock = stocks?.find((s) => s.variant_id === v.id)
            const currentStock = stock ? Number(stock.on_hand) : 0
            return {
              ...v,
              current_qty: currentStock,
              reserved_qty: 0,
              available_qty: currentStock
            }
          })

          // Nest variants inside product families
          const productsWithVariants = prods.map((p) => ({
            ...p,
            category_name: p.category || 'Uncategorized',
            variants: mappedVariants.filter((v) => v.family_id === p.id)
          }))

          setAllProducts(productsWithVariants)

          // Derive categories from the 'category' string
          const uniqueCats = Array.from(new Set(productsWithVariants.map((p) => p.category_name)))
          setCategories(uniqueCats.map((catName) => ({
            id: catName.toLowerCase().replace(/\s+/g, '-'),
            name: catName,
            count: productsWithVariants.filter(p => p.category_name === catName).length
          })))
        }
      } else {
        // --- OFFLINE: Fetch catalog from Dexie ---
        const localVars = await db.variants.where('branch_id').equals(activeBranchId).toArray()
        const localReservations = await db.reservations.where('branch_id').equals(activeBranchId).toArray()

        // Extract categories and families locally
        const categoriesMap: Record<string, string> = {}
        const familiesMap: Record<string, any> = {}

        localVars.forEach((v) => {
          const catName = v.category_name || 'Uncategorized'
          categoriesMap[catName] = catName
          
          if (v.family_id) {
            if (!familiesMap[v.family_id]) {
              familiesMap[v.family_id] = {
                id: v.family_id,
                name: v.name.split(' (')[0], // Extract family name
                brand: v.brand || 'Unbranded',
                category_name: catName,
                variants: []
              }
            }

            familiesMap[v.family_id].variants.push({
              id: v.id,
              size: v.size,
              color: v.color,
              selling_price: v.sell_price,
              cost_price: v.cost_price,
              current_qty: v.quantity,
              reserved_qty: 0,
              available_qty: v.quantity
            })
          }
        })

        const computedProducts = Object.values(familiesMap)
        setAllProducts(computedProducts)

        const computedCats = Object.keys(categoriesMap).map((catName, idx) => ({
          id: catName.toLowerCase().replace(/\s+/g, '-'),
          name: catName,
          count: computedProducts.filter((p: any) => p.category_name === catName).length
        }))
        setCategories(computedCats)
      }
    } catch (e) {
      console.error('Failed to load POS catalog data', e)
      toast.error(pos.loadFail)
    } finally {
      setLoading(false)
    }
  }

  // Fetch when branch state changes
  useEffect(() => {
    fetchCatalogData()
  }, [activeBranchId, isOnline])

  // Derived Products (Filtering)
  const displayedProducts = allProducts.filter(p => {
    const categoryMatch = activeCategory === 'all' || 
                          p.category_name?.toLowerCase().replace(/\s+/g, '-') === activeCategory
    const searchMatch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
    return categoryMatch && searchMatch
  })

  // Select family to open sizes drawer
  const selectProduct = (product: any) => {
    setSelectedProduct(product)
  }

  const addToCart = (variant: any, productName: string) => {
    // 1. Calculate maximum available stock
    const available = variant.available_qty ?? 0
    const existing = cart.find(item => item.variant_id === variant.id)
    const currentQtyInCart = existing ? existing.quantity : 0

    // 2. Prevent adding if stock would go negative
    if (currentQtyInCart + 1 > available) {
      toast.error(pos.stockOut(available))
      return
    }

    if (existing) {
      setCart(cart.map(item => 
        item.variant_id === variant.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, {
        variant_id: variant.id,
        product_name: productName,
        size: variant.size,
        color: variant.color,
        quantity: 1,
        unit_price: variant.selling_price || variant.sell_price || 0,
        cost_price: variant.cost_price || 0,
        max_available: available
      }])
    }
    
    setSelectedProduct(null)
  }

  const updateQuantity = (variantId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.variant_id === variantId) {
        const newQty = item.quantity + delta
        if (newQty > item.max_available) {
          toast.error(pos.overStock(item.max_available))
          return item
        }
        return { ...item, quantity: Math.max(1, newQty) }
      }
      return item
    }))
  }

  const removeFromCart = (variantId: string) => {
    setCart(cart.filter(item => item.variant_id !== variantId))
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)

  // Checkout Execution: Queueing the sale mutation to the offline sync engine
  const handleProcessPayment = async (method: string, amountTendered: number) => {
    if (!activeBranchId || activeBranchId === 'HQ' || activeBranchId === 'all') {
      toast.error('You must select a concrete branch to complete sales.')
      return
    }

    setLoading(true)
    try {
      const generatedReceipt = `${branchPrefix}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`

      // Build payload for complete_sale RPC
      const salePayload = {
        client_id: ulid(), // Idempotency key
        branch_id: activeBranchId,
        customer_id: null,
        payment_method: method,
        payment_meta: { amount_tendered: amountTendered, cash_amount: amountTendered },
        discount_amount: 0,
        lines: cart.map(item => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_discount: 0
        }))
      }

      // Add to sync queue for offline operation using the canonical RPC
      await addToSyncQueue('sale', salePayload, activeTenantId)

      toast.success(pos.paySuccess(generatedReceipt))
      setCheckoutState('success')
    } catch (error: any) {
      console.error('Checkout error:', error)
      toast.error(pos.payFail)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckoutComplete = () => {
    setCart([])
    setCheckoutState('cart')
    // Refresh catalog stock
    fetchCatalogData()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] lg:h-[calc(100vh-80px)] overflow-hidden bg-nx-bg">
      {/* 1. Session Bar with Sync observations */}
      <div className="h-[48px] bg-nx-surface border-b border-nx-border px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 font-ui text-[13px] text-nx-text-sec">
          <span className="font-semibold text-nx-text">{pos.title}</span>
          <span>•</span>
          <span>Shift session: {cashSessionId ? pos.sessionActive : pos.sessionNone}</span>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1.5 font-ui text-xs text-nx-green font-semibold bg-nx-green/10 px-2.5 py-1 rounded-full">
              <Wifi className="w-3.5 h-3.5" /> {pos.online}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-ui text-xs text-nx-amber font-semibold bg-nx-amber/10 px-2.5 py-1 rounded-full">
              <WifiOff className="w-3.5 h-3.5" /> {pos.offline}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Workspace (Left) */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-6 pb-0 flex flex-col h-full">
            {/* 2. Category Bar */}
            <CategoryBar 
              categories={categories}
              activeCategory={activeCategory}
              onSelectCategory={setActiveCategory}
            />

            {/* Search Bar */}
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={pos.searchPlaceholder}
                className="w-full bg-nx-surface border border-nx-border text-nx-text font-ui text-[14px] pl-10 pr-4 py-3 rounded-nx-btn focus:outline-none focus:border-nx-cyan transition-colors"
              />
            </div>

            {/* 3. Product Grid */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
              {loading && allProducts.length === 0 ? (
                <div className="h-full flex items-center justify-center text-nx-text-muted font-ui text-[14px] animate-pulse">
                  {pos.loading}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {displayedProducts.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isSelected={selectedProduct?.id === product.id}
                      onClick={selectProduct}
                    />
                  ))}
                </div>
              )}
              
              {!loading && displayedProducts.length === 0 && (
                <div className="h-full flex items-center justify-center text-nx-text-muted font-ui text-[14px]">
                  {pos.noProducts}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. Variant Panel */}
        <VariantPanel 
          product={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onSelectVariant={(variant) => addToCart(variant, selectedProduct.name)}
        />

        {/* Checkout Panels (Right) */}
        <div className="hidden md:block">
          {checkoutState === 'cart' && (
            <OrderPanel 
              cart={cart}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeFromCart}
              onCharge={() => setCheckoutState('payment')}
            />
          )}

          {checkoutState === 'payment' && (
            <PaymentPanel
              total={subtotal}
              onBack={() => setCheckoutState('cart')}
              onConfirm={handleProcessPayment}
            />
          )}

          {checkoutState === 'success' && (
            <SuccessState
              total={subtotal}
              onComplete={handleCheckoutComplete}
            />
          )}
        </div>
      </div>
    </div>
  )
}
