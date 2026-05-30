'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/sync/db'
import { 
  createTransferAction, 
  dispatchTransferAction, 
  receiveTransferAction, 
  cancelTransferAction 
} from '@/lib/actions/transfers'
import { 
  ArrowRightLeft, 
  Plus, 
  Send, 
  CheckSquare, 
  XSquare, 
  FileText, 
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'

export default function TransfersPage() {
  const supabase = createClient()

  // App Context
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [loading, setLoading] = useState(true)

  // Data States
  const [transfers, setTransfers] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [variants, setVariants] = useState<any[]>([])

  // Modal / Form States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null)
  const [fromBranchId, setFromBranchId] = useState('')
  const [toBranchId, setToBranchId] = useState('')
  const [selectedItems, setSelectedItems] = useState<{ variant_id: string; quantity: number; available_qty: number; name: string }[]>([])
  const [notes, setNotes] = useState('')
  
  // Received quantities form state
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({})

  // 1. Connection listeners
  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsOnline(navigator.onLine)
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // 2. Fetch initial user, branches, variants, transfers
  const loadData = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, branch_id, tenant_id')
        .eq('id', session.user.id)
        .single()

      setUserProfile(profile)

      if (navigator.onLine) {
        // Load from Supabase
        const { data: branchData } = await supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
        
        setBranches(branchData || [])

        const { data: transferData } = await supabase
          .from('transfers')
          .select(`
            *,
            from_branch:from_branch_id(name),
            to_branch:to_branch_id(name),
            transfer_items(
              id,
              variant_id,
              quantity,
              received_qty,
              product_variants(
                size,
                color,
                product_families(name)
              )
            )
          `)
          .order('created_at', { ascending: false })

        setTransfers(transferData || [])

        // Load all active variants for selection
        const { data: variantData } = await supabase
          .from('product_variants')
          .select(`
            id,
            sku,
            size,
            color,
            product_families(name, brand)
          `)
          .eq('is_active', true)

        // Load stock levels to check availability
        const { data: stockData } = await supabase
          .from('current_stock')
          .select('*')

        // Load reservations
        const { data: resData } = await supabase
          .from('inventory_reservations')
          .select('*')

        if (variantData) {
          const mappedVars = variantData.map((v: any) => {
            const stock = stockData?.find(s => s.variant_id === v.id && s.branch_id === profile.branch_id)
            const currentQty = stock ? Number(stock.current_quantity) : 0
            const reserved = resData?.filter(r => r.variant_id === v.id && r.branch_id === profile.branch_id).reduce((sum, r) => sum + r.quantity, 0) || 0
            return {
              id: v.id,
              sku: v.sku,
              name: `${v.product_families?.name || ''} (${v.color || ''} - Size ${v.size})`,
              available_qty: Math.max(0, currentQty - reserved)
            }
          })
          setVariants(mappedVars)
        }
      } else {
        // Load from Dexie
        const localTransfers = await db.transfers.toArray()
        setTransfers(localTransfers)

        const localVars = await db.variants.toArray()
        const mappedVars = localVars.map(v => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          available_qty: v.quantity
        }))
        setVariants(mappedVars)
      }
    } catch (e: any) {
      console.error(e)
      toast.error('Imeshindwa kupakia data ya uhamisho')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [isOnline])

  // Create new transfer handler
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromBranchId || !toBranchId) {
      toast.error('Tafadhali chagua matawi husika')
      return
    }
    if (selectedItems.length === 0) {
      toast.error('Tafadhali chagua angalau bidhaa moja')
      return
    }

    try {
      const itemsPayload = selectedItems.map(item => ({
        variant_id: item.variant_id,
        quantity: item.quantity
      }))

      if (isOnline) {
        await createTransferAction(fromBranchId, toBranchId, itemsPayload, notes)
        toast.success('Uhamisho umehifadhiwa kama Draft (Transfer draft created)')
      } else {
        // Offline: save to Dexie transfers queue
        const localPayload = {
          id: `transfer-${crypto.randomUUID()}`,
          tenant_id: userProfile.tenant_id,
          from_branch_id: fromBranchId,
          to_branch_id: toBranchId,
          status: 'draft' as const,
          notes,
          items: selectedItems,
          updated_at: new Date().toISOString()
        }
        await db.transfers.put(localPayload)
        toast.success('Uhamisho umehifadhiwa kienyeji (Draft saved locally)')
      }

      setIsCreateOpen(false)
      setSelectedItems([])
      setNotes('')
      loadData()
    } catch (e: any) {
      toast.error(e.message || 'Imeshindwa kutengeneza uhamisho')
    }
  }

  // Dispatch handler
  const handleDispatch = async (id: string) => {
    try {
      if (isOnline) {
        await dispatchTransferAction(id)
        toast.success('Mzigo umetumwa rasmi! Akiba imewekewa zuio (Transfer dispatched successfully)')
        setSelectedTransfer(null)
        loadData()
      } else {
        toast.error('Kitendo hiki kinahitaji mtandao ili kuthibitisha akiba (Internet connection required to dispatch)')
      }
    } catch (e: any) {
      toast.error(e.message || 'Dispatch failed')
    }
  }

  // Receive handler
  const handleReceive = async (id: string) => {
    try {
      if (isOnline) {
        await receiveTransferAction(id, receivedQtys)
        toast.success('Mzigo umepokelewa na kuingizwa stoki! (Transfer received successfully)')
        setSelectedTransfer(null)
        loadData()
      } else {
        toast.error('Kupokea mzigo kunahitaji kuwa online ili kusasisha stoki (Internet connection required to receive)')
      }
    } catch (e: any) {
      toast.error(e.message || 'Receipt failed')
    }
  }

  // Cancel handler
  const handleCancel = async (id: string) => {
    if (!confirm('Una uhakika unataka kufuta uhamisho huu?')) return
    try {
      if (isOnline) {
        await cancelTransferAction(id)
        toast.success('Uhamisho umefutwa na stoki kurejeshwa (Transfer cancelled)')
        setSelectedTransfer(null)
        loadData()
      } else {
        toast.error('Kitendo hiki kinahitaji mtandao (Internet connection required to cancel)')
      }
    } catch (e: any) {
      toast.error(e.message || 'Cancellation failed')
    }
  }

  // Add item helper in form
  const addItemToTransfer = (variantId: string, qty: number) => {
    const v = variants.find(item => item.id === variantId)
    if (!v) return

    if (qty > v.available_qty) {
      toast.error(`Kiwango kinazidi akiba iliyopo. Akiba iliyopo ni pea ${v.available_qty}`)
      return
    }

    const existing = selectedItems.find(item => item.variant_id === variantId)
    if (existing) {
      setSelectedItems(selectedItems.map(item => 
        item.variant_id === variantId ? { ...item, quantity: qty } : item
      ))
    } else {
      setSelectedItems([...selectedItems, {
        variant_id: variantId,
        quantity: qty,
        available_qty: v.available_qty,
        name: v.name
      }])
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-nx-bg min-h-screen">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-nx-border pb-5">
        <div>
          <h1 className="font-ui text-2xl font-bold text-nx-text flex items-center gap-2">
            <ArrowRightLeft className="w-7 h-7 text-nx-cyan" />
            Uhamisho wa Bidhaa (Inter-Branch Transfers)
          </h1>
          <p className="text-xs text-nx-text-muted mt-1">
            Usimamizi na uhamisho wa stoki kati ya maduka mbalimbali kwa usalama na bila makosa ya hesabu.
          </p>
        </div>
        {userProfile?.role !== 'cashier' && (
          <button
            onClick={() => {
              setFromBranchId(userProfile?.branch_id || '')
              setIsCreateOpen(true)
            }}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-nx-cyan hover:bg-nx-cyan/90 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Uhamisho Mpya (New Transfer)
          </button>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Transfers List (Left & Middle) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-nx-surface border border-nx-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-nx-border bg-nx-surface">
              <h3 className="font-ui text-xs font-bold text-nx-text uppercase tracking-wider">
                Orodha ya Uhamisho (Transfer Logs)
              </h3>
            </div>

            {loading ? (
              <div className="p-8 text-center text-nx-text-sec flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Kupakia data ya uhamisho...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-nx-border text-xs">
                  <thead className="bg-nx-surface/50 text-[10px] font-bold text-nx-text-sec uppercase tracking-wider text-left">
                    <tr>
                      <th className="px-6 py-3">Tarehe</th>
                      <th className="px-6 py-3">Kutoka {"->"} Kwenda</th>
                      <th className="px-6 py-3">Hali (Status)</th>
                      <th className="px-6 py-3">Maelezo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nx-border text-nx-text-sec">
                    {transfers.map(t => (
                      <tr 
                        key={t.id} 
                        onClick={() => {
                          setSelectedTransfer(t)
                          const initialQtys: Record<string, number> = {}
                          t.transfer_items?.forEach((item: any) => {
                            initialQtys[item.id] = item.quantity
                          })
                          setReceivedQtys(initialQtys)
                        }}
                        className={`cursor-pointer hover:bg-nx-surface/40 transition-colors ${selectedTransfer?.id === t.id ? 'bg-nx-cyan/5' : ''}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-nx-text-muted">
                          {new Date(t.created_at).toLocaleDateString('en-TZ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-nx-text flex items-center gap-1.5">
                            <span>{t.from_branch?.name || 'Ghala Kuu'}</span>
                            <ArrowRight className="w-3 h-3 text-nx-text-muted" />
                            <span>{t.to_branch?.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            t.status === 'draft' ? 'bg-nx-elevated text-nx-text' :
                            t.status === 'dispatched' ? 'bg-nx-orange/10 text-nx-orange border border-nx-orange/20' :
                            t.status === 'received' ? 'bg-nx-green/10 text-nx-green border border-nx-green/20' :
                            'bg-nx-red/10 text-nx-red border border-nx-red/20'
                          }`}>
                            {t.status === 'draft' ? 'Draft' :
                             t.status === 'dispatched' ? 'In Transit' :
                             t.status === 'received' ? 'Imepokewa' : 'Cancelled'}
                          </span>
                        </td>
                        <td className="px-6 py-4 truncate max-w-[150px] text-nx-text-muted">
                          {t.notes || 'N/A'}
                        </td>
                      </tr>
                    ))}

                    {transfers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-nx-text-muted font-ui">
                          Hakuna rekodi za uhamisho wa bidhaa kwa sasa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Transfer Detail Panel (Right) */}
        <div className="space-y-4">
          {selectedTransfer ? (
            <div className="bg-nx-surface border border-nx-border rounded-xl shadow-sm p-5 space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-nx-border pb-3">
                <h3 className="font-ui text-sm font-bold text-nx-text flex items-center gap-1">
                  <FileText className="w-4 h-4 text-nx-cyan" />
                  Kagua Uhamisho (Detail Review)
                </h3>
                <span className="text-[10px] font-mono text-nx-text-muted">ID: {selectedTransfer.id.slice(0, 8)}...</span>
              </div>

              {/* Status and summary */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-nx-text-muted">Kutoka (Source):</span>
                  <span className="font-semibold text-nx-text">{selectedTransfer.from_branch?.name || 'Tawi la Chanzo'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-nx-text-muted">Kwenda (Destination):</span>
                  <span className="font-semibold text-nx-text">{selectedTransfer.to_branch?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-nx-text-muted">Hali (Status):</span>
                  <span className="font-bold uppercase text-nx-cyan">{selectedTransfer.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-nx-text-muted">Kumbukumbu (Notes):</span>
                  <span className="text-nx-text-sec italic">{selectedTransfer.notes || 'N/A'}</span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-nx-text-muted uppercase tracking-widest">Orodha ya Bidhaa (Items):</p>
                <div className="border border-nx-border bg-nx-surface/30 rounded-lg divide-y divide-nx-border overflow-hidden">
                  {selectedTransfer.transfer_items?.map((item: any) => (
                    <div key={item.id} className="p-3 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-nx-text">
                          {item.product_variants?.product_families?.name || 'Bidhaa'}
                        </p>
                        <p className="text-[10px] text-nx-text-muted">
                          Color: {item.product_variants?.color || 'N/A'} • Size: {item.product_variants?.size}
                        </p>
                      </div>
                      
                      {selectedTransfer.status === 'dispatched' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-nx-text-muted text-[10px]">Alituma: {item.quantity}</span>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={receivedQtys[item.id] ?? item.quantity}
                            onChange={(e) => setReceivedQtys({
                              ...receivedQtys,
                              [item.id]: Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0))
                            })}
                            className="w-12 bg-nx-elevated border border-nx-border text-nx-text text-center text-xs py-1 rounded focus:outline-none focus:border-nx-cyan"
                          />
                        </div>
                      ) : (
                        <div className="text-right">
                          <p className="font-semibold text-nx-text">Kiwango: {item.quantity} pea</p>
                          {item.received_qty !== null && (
                            <p className="text-[10px] text-nx-green font-medium">Imepokewa: {item.received_qty} pea</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2 border-t border-nx-border">
                {selectedTransfer.status === 'draft' && userProfile?.role !== 'cashier' && (
                  <button
                    onClick={() => handleDispatch(selectedTransfer.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-nx-cyan hover:bg-nx-cyan/90 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Tuma Mzigo (Dispatch Transfer)
                  </button>
                )}

                {selectedTransfer.status === 'dispatched' && userProfile?.role !== 'cashier' && (
                  <button
                    onClick={() => handleReceive(selectedTransfer.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-nx-green hover:bg-nx-green/90 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Thibitisha Upokeaji (Confirm Receive)
                  </button>
                )}

                {['draft', 'dispatched'].includes(selectedTransfer.status) && userProfile?.role !== 'cashier' && (
                  <button
                    onClick={() => handleCancel(selectedTransfer.id)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-nx-surface border border-nx-red/20 hover:bg-nx-red/10 text-nx-red text-xs font-semibold rounded-xl transition-all"
                  >
                    <XSquare className="w-3.5 h-3.5" />
                    Futa Uhamisho (Cancel Transfer)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-nx-surface border border-nx-border rounded-xl shadow-sm p-6 text-center text-nx-text-sec text-xs h-64 flex flex-col justify-center items-center">
              <ArrowRightLeft className="w-8 h-8 text-nx-text-muted/40 mb-3" />
              Tafadhali chagua rekodi ya uhamisho ili kuona maelezo au kufanya maamuzi ya stoki.
            </div>
          )}
        </div>
      </div>

      {/* CREATE NEW TRANSFER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateTransfer} className="bg-nx-surface border border-nx-border rounded-2xl p-6 max-w-xl w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="font-ui text-base font-bold text-nx-text border-b border-nx-border pb-3 flex items-center gap-2">
              <Plus className="w-5 h-5 text-nx-cyan" />
              Sajili Uhamisho Mpya wa Stoki (New Stock Transfer)
            </h3>

            {/* Select Branches */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-nx-text-muted uppercase tracking-wider">Kutoka (Source branch)</label>
                <select
                  value={fromBranchId}
                  onChange={(e) => setFromBranchId(e.target.value)}
                  className="w-full bg-nx-bg border border-nx-border text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-nx-cyan"
                >
                  <option value="">Chagua tawi la chanzo...</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-nx-text-muted uppercase tracking-wider">Kwenda (Target branch)</label>
                <select
                  value={toBranchId}
                  onChange={(e) => setToBranchId(e.target.value)}
                  className="w-full bg-nx-bg border border-nx-border text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-nx-cyan"
                >
                  <option value="">Chagua tawi lengo...</option>
                  {branches.filter(b => b.id !== fromBranchId).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Select Variant and Quantity */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-nx-text-muted uppercase tracking-wider">Chagua Bidhaa ya Kuhamisha (Add variant)</label>
              <div className="flex gap-2">
                <select
                  id="variant-select"
                  className="flex-1 bg-nx-bg border border-nx-border text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-nx-cyan"
                  onChange={(e) => {
                    const select = e.target
                    const val = select.value
                    if (val) {
                      const input = document.getElementById('qty-input') as HTMLInputElement
                      const availableSpan = document.getElementById('available-span')
                      const v = variants.find(item => item.id === val)
                      if (input && availableSpan && v) {
                        input.max = v.available_qty.toString()
                        availableSpan.innerText = `Available: ${v.available_qty} pair`
                      }
                    }
                  }}
                >
                  <option value="">Chagua bidhaa...</option>
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>{v.name} [SKU: {v.sku}] ({v.available_qty} available)</option>
                  ))}
                </select>
                
                <input
                  type="number"
                  id="qty-input"
                  min="1"
                  placeholder="Kiasi"
                  className="w-20 bg-nx-bg border border-nx-border text-center text-xs rounded-lg focus:outline-none focus:border-nx-cyan"
                />

                <button
                  type="button"
                  onClick={() => {
                    const varSelect = document.getElementById('variant-select') as HTMLSelectElement
                    const qtyInput = document.getElementById('qty-input') as HTMLInputElement
                    if (varSelect.value && qtyInput.value) {
                      addItemToTransfer(varSelect.value, parseInt(qtyInput.value) || 0)
                      qtyInput.value = ''
                    } else {
                      toast.error('Chagua bidhaa na uingize kiasi husika')
                    }
                  }}
                  className="py-2 px-4 bg-nx-elevated hover:bg-nx-hover text-nx-text text-xs font-semibold rounded-lg transition-colors border border-nx-border"
                >
                  Ongeza
                </button>
              </div>
              <span id="available-span" className="text-[10px] text-nx-cyan font-semibold block"></span>
            </div>

            {/* Selected Items Table */}
            {selectedItems.length > 0 && (
              <div className="border border-nx-border rounded-xl bg-nx-surface/30 overflow-hidden text-xs">
                <div className="p-3 border-b border-nx-border bg-nx-surface font-semibold text-nx-text-sec">Bidhaa Zilizochaguliwa (Selected Items):</div>
                <div className="divide-y divide-nx-border max-h-40 overflow-y-auto">
                  {selectedItems.map(item => (
                    <div key={item.variant_id} className="p-2.5 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-nx-text">{item.name}</p>
                        <p className="text-[10px] text-nx-text-muted">Max available: {item.available_qty} pairs</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-nx-cyan">{item.quantity} pea</span>
                        <button
                          type="button"
                          onClick={() => setSelectedItems(selectedItems.filter(i => i.variant_id !== item.variant_id))}
                          className="text-nx-red hover:text-nx-red/80 text-xs p-1"
                        >
                          Futa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-nx-text-muted uppercase tracking-wider">Kumbukumbu / Sababu (Notes)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ingiza maelezo kuhusu uhamisho huu (e.g. upungufu wa stoki, duka jipya)..."
                rows={2}
                className="w-full bg-nx-bg border border-nx-border text-xs p-3 rounded-lg focus:outline-none focus:border-nx-cyan resize-none"
              />
            </div>

            {/* Form actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-nx-border">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false)
                  setSelectedItems([])
                }}
                className="py-2.5 px-4 bg-nx-surface border border-nx-border hover:bg-nx-surface text-nx-text-sec text-xs font-semibold rounded-xl transition-all"
              >
                Ghairi (Cancel)
              </button>
              <button
                type="submit"
                className="py-2.5 px-4 bg-nx-cyan hover:bg-nx-cyan/90 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
              >
                Hifadhi Draft (Save Draft)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
