'use client'

import React, { useState, useMemo } from 'react'
import { Plus, Search, Info, Phone, Mail, MapPin, Notebook, PlusCircle, Check, Loader2, User } from 'lucide-react'
import { SupplierCard } from '@/components/workspace/suppliers/supplier-card'
import { addToSyncQueue } from '@/lib/sync/sync-engine'
import { useSyncStatus } from '@/lib/sync/use-sync-status'

const DEMO_SUPPLIERS = [
  {
    id: 'dsup-1',
    name: 'Kariakoo Footwear Wholesalers',
    contact_person: 'Ali Mwinyi',
    phone: '+255 754 112 233',
    email: 'ali@kariakoofootwear.com',
    address: 'Kariakoo Market, Street 4, Dar es Salaam',
    notes: 'Premium Safari boots vendor. Delivery turnaround: 3 days.',
    total_spend: 14200000,
    balance_due: 0,
    is_active: true,
    fulfilled_orders_count: 24,
    late_orders_count: 1
  },
  {
    id: 'dsup-2',
    name: 'Zanzibar Shoes Distributor',
    contact_person: 'Fatma Juma',
    phone: '+255 682 990 887',
    email: 'contact@zanzibarshoes.com',
    address: 'Mji Mkongwe, Zanzibar',
    notes: 'Casual and sport lines supplier. Negotiated 30-day net payment.',
    total_spend: 6500000,
    balance_due: 1450000,
    is_active: true,
    fulfilled_orders_count: 12,
    late_orders_count: 3
  }
]

interface SuppliersContainerProps {
  initialSuppliers: any[]
  initialPurchases: any[]
}

export function SuppliersContainer({ initialSuppliers, initialPurchases }: SuppliersContainerProps) {
  const isDemoMode = initialSuppliers.length === 0
  const suppliersDataset = isDemoMode ? DEMO_SUPPLIERS : initialSuppliers
  const { isOnline } = useSyncStatus()

  // State Management
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliersDataset[0]?.id || '')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add Supplier Form State
  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  // Filter suppliers list
  const filteredSuppliers = useMemo(() => {
    return suppliersDataset.filter(sup => {
      if (!sup.is_active && !isDemoMode) return false
      const query = searchQuery.toLowerCase()
      return sup.name.toLowerCase().includes(query) || 
             (sup.contact_person && sup.contact_person.toLowerCase().includes(query)) ||
             sup.phone.includes(query)
    })
  }, [suppliersDataset, searchQuery, isDemoMode])

  // Get active selected supplier
  const selectedSupplier = useMemo(() => {
    return suppliersDataset.find(sup => sup.id === selectedSupplierId) || suppliersDataset[0]
  }, [suppliersDataset, selectedSupplierId])

  // Get purchases for selected supplier
  const supplierPurchases = useMemo(() => {
    if (isDemoMode) {
      return [
        { id: 'dp-1', purchase_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), total_amount: 2500000, status: 'completed' },
        { id: 'dp-2', purchase_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(), total_amount: 1450000, status: 'completed' }
      ]
    }
    return initialPurchases.filter(p => p.supplier_id === selectedSupplier?.id)
  }, [initialPurchases, selectedSupplier, isDemoMode])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  // Handle addition of supplier (offline-safe)
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) {
      return alert('Supplier Name and Contact Phone are required.')
    }

    setIsSubmitting(true)
    try {
      const supplierPayload = {
        name,
        contact_person: contactPerson,
        phone,
        email,
        address,
        notes,
        is_active: true
      }

      // Queue action offline-safe
      addToSyncQueue('supplier', supplierPayload)

      alert(
        isOnline 
          ? 'Supplier details submitted successfully!' 
          : 'Offline Mode: Supplier detail draft saved locally. It will sync upon connection.'
      )

      // Reset
      setName('')
      setContactPerson('')
      setPhone('')
      setEmail('')
      setAddress('')
      setNotes('')
      setIsAddOpen(false)
    } catch (e) {
      console.error(e)
      alert('Failed to register supplier.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6 pb-12 flex flex-col gap-6 font-ui">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-nx-cyan/10 border border-nx-cyan/20 rounded-nx-card p-4 flex items-start gap-3 select-none">
          <Info className="w-5 h-5 text-nx-cyan shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[13px] font-bold text-nx-text">Demo Visualization Layer Active</h4>
            <p className="text-[12px] text-nx-text-sec leading-relaxed">
              No suppliers are registered in the database. NEXPOS is displaying mock distributors for showcase purposes. Click "Register Supplier" to add suppliers offline-safely.
            </p>
          </div>
        </div>
      )}

      {/* Header Strip */}
      <div className="flex items-center justify-between pt-4 shrink-0">
        <div>
          <h1 className="text-[22px] font-bold text-nx-text leading-[1.3] mb-1">
            Supplier Intelligence
          </h1>
          <p className="text-nx-text-sec text-[12px]">
            Distributor profiles, spend metrics, and delivery histories
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="bg-nx-cyan hover:bg-nx-cyan/90 text-white px-4 py-2 rounded-nx-btn flex items-center text-[13px] font-medium transition-all duration-150 active:scale-[0.97] select-none"
        >
          <Plus className="w-4 h-4 mr-2" />
          Register Supplier
        </button>
      </div>

      {/* Split Layout Container */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_400px] gap-6 items-start flex-grow">
        {/* Left Side: Directory List */}
        <div className="space-y-4">
          {/* List Filters */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nx-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, contact, phone..."
              className="w-full bg-nx-surface border border-nx-border text-nx-text text-[13px] pl-9 pr-4 py-2 rounded-nx-btn focus:outline-none focus:border-nx-cyan transition-colors"
            />
          </div>

          {/* Directory Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
            {filteredSuppliers.map(sup => (
              <SupplierCard 
                key={sup.id}
                supplier={sup}
                isSelected={selectedSupplier?.id === sup.id}
                onSelect={(s) => setSelectedSupplierId(s.id)}
              />
            ))}
            
            {filteredSuppliers.length === 0 && (
              <div className="col-span-2 py-12 text-center text-nx-text-muted text-[13px]">
                No suppliers registered yet
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detail Panel */}
        {selectedSupplier ? (
          <div className="bg-nx-surface border border-nx-border rounded-nx-card p-5 space-y-6 select-none shrink-0 sticky top-4">
            <div className="flex items-center gap-3 border-b border-nx-border pb-4">
              <div className="w-10 h-10 rounded-full bg-nx-cyan/10 flex items-center justify-center text-nx-cyan text-[14px] font-bold">
                {selectedSupplier.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-[14px] text-nx-text line-clamp-1">{selectedSupplier.name}</h3>
                <span className="text-[11px] text-nx-text-sec">Profile Details</span>
              </div>
            </div>

            {/* Profile Info fields */}
            <div className="space-y-3 text-[13px]">
              <div className="flex items-start gap-3">
                <User className="w-4.5 h-4.5 text-nx-text-muted mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Contact Person</span>
                  <p className="font-semibold text-nx-text mt-0.5">{selectedSupplier.contact_person || 'None'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4.5 h-4.5 text-nx-text-muted mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Phone Line</span>
                  <p className="font-data text-nx-text mt-0.5">{selectedSupplier.phone}</p>
                </div>
              </div>

              {selectedSupplier.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-4.5 h-4.5 text-nx-text-muted mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Email Address</span>
                    <p className="text-nx-text mt-0.5 truncate max-w-[280px]">{selectedSupplier.email}</p>
                  </div>
                </div>
              )}

              {selectedSupplier.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4.5 h-4.5 text-nx-text-muted mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Warehouse Address</span>
                    <p className="text-nx-text mt-0.5 leading-relaxed">{selectedSupplier.address}</p>
                  </div>
                </div>
              )}

              {selectedSupplier.notes && (
                <div className="flex items-start gap-3">
                  <Notebook className="w-4.5 h-4.5 text-nx-text-muted mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] text-nx-text-muted uppercase font-bold tracking-wider">Logistical Notes</span>
                    <p className="text-nx-text-sec mt-0.5 leading-relaxed text-[12px]">{selectedSupplier.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Spend History list */}
            <div className="space-y-3 pt-2">
              <h4 className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Purchase History</h4>
              <div className="border border-nx-border rounded-nx-card overflow-hidden text-[12px]">
                <div className="bg-nx-elevated px-4 py-2 border-b border-nx-border flex justify-between font-semibold text-nx-text-sec text-[10px]">
                  <span>Date</span>
                  <span>Total Cost</span>
                </div>
                <div className="divide-y divide-nx-border/50 max-h-[140px] overflow-y-auto">
                  {supplierPurchases.length > 0 ? (
                    supplierPurchases.map((p: any) => (
                      <div key={p.id} className="px-4 py-2.5 flex justify-between items-center hover:bg-nx-hover/20">
                        <span className="text-nx-text-sec font-data">
                          {new Date(p.purchase_date).toLocaleDateString()}
                        </span>
                        <span className="font-data font-bold text-nx-text">
                          {formatCurrency(p.total_amount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-nx-text-muted">
                      No purchases logged yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-nx-surface border border-nx-border rounded-nx-card p-8 text-center text-nx-text-muted text-[13px]">
            No supplier selected.
          </div>
        )}
      </div>

      {/* Register Supplier Drawer Modal */}
      {isAddOpen && (
        <>
          <div 
            onClick={() => setIsAddOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-50 transition-opacity"
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-[420px] bg-nx-surface border-l border-nx-border shadow-[0_0_24px_rgba(0,0,0,0.15)] z-50 flex flex-col transform transition-transform duration-300 ease-out translate-x-0 font-ui select-none">
            <div className="p-5 border-b border-nx-border flex items-center justify-between bg-nx-elevated/40">
              <h3 className="font-semibold text-[15px] text-nx-text">Register Supplier</h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1 hover:bg-nx-hover rounded">
                <X className="w-5 h-5 text-nx-text-sec" />
              </button>
            </div>
            
            <form onSubmit={handleAddSupplier} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kariakoo Footwear Wholesalers"
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Contact Person</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Contact manager name"
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Phone Line *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +255 754 112 233"
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="supplier@mail.com"
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Warehouse Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="City, Street, Building"
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] px-3 py-2 rounded-nx-btn focus:outline-none focus:border-nx-cyan"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Logistical Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Terms, minimum order size, delivery times..."
                  rows={3}
                  className="w-full bg-nx-elevated border border-nx-border text-nx-text text-[13px] p-3 rounded-nx-btn focus:outline-none focus:border-nx-cyan resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-nx-cyan hover:bg-nx-cyan/90 text-white font-semibold text-[13px] py-3 rounded-nx-btn flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-sm mt-6"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Confirm Supplier</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}

// Inline closing icon override for registry modal
function X(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  )
}
