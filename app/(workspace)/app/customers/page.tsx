'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Plus, UserPlus } from 'lucide-react'
import Link from 'next/link'

export default function CustomersPage() {
  const supabase = createClient()
  const [customers, setCustomers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    customer_type: 'cash',
    credit_limit: '0',
  })

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from('customers').insert({
        ...formData,
        credit_limit: parseFloat(formData.credit_limit),
        created_by: user.id,
      })

      if (error) throw error

      setShowAddForm(false)
      setFormData({ full_name: '', phone: '', email: '', customer_type: 'cash', credit_limit: '0' })
      loadCustomers()
    } catch (error: any) {
      alert('Failed to add customer: ' + error.message)
    }
  }

  const filteredCustomers = customers.filter(c => 
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-5xl font-bold text-nx-text mb-2">Customers</h1>
          <p className="text-nx-text-sec">Manage customer database</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="glass-card p-6 mb-8">
          <h2 className="font-display text-2xl font-bold text-nx-text mb-6">New Customer</h2>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Full Name *</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
                required
              />
            </div>
            <div>
              <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Phone *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
                required
              />
            </div>
            <div>
              <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
              />
            </div>
            <div>
              <label className="block font-label uppercase text-xs tracking-wider text-nx-text-sec mb-2">Type</label>
              <select
                value={formData.customer_type}
                onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                className="w-full bg-nx-surface border border-nx-border text-nx-text px-4 py-3 focus:outline-none focus:border-nx-gold"
              >
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
                <option value="wholesale">Wholesale</option>
              </select>
            </div>
            <div className="md:col-span-2 flex gap-4">
              <button type="submit" className="btn-primary">Save Customer</button>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nx-text-sec" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full bg-nx-surface border border-nx-border text-nx-text pl-12 pr-4 py-3 focus:outline-none focus:border-nx-gold"
        />
      </div>

      {/* Customers Table */}
      <div className="glass-card p-6">
        {filteredCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-nx-border">
                <tr>
                  <th className="text-left py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Name</th>
                  <th className="text-left py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Phone</th>
                  <th className="text-left py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Email</th>
                  <th className="text-left py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Type</th>
                  <th className="text-right py-3 px-4 font-label uppercase text-xs tracking-wider text-nx-text-sec">Credit Limit</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer: any) => (
                  <tr key={customer.id} className="border-b border-nx-border/50 hover:bg-nx-surface/30">
                    <td className="py-4 px-4 text-nx-text font-medium">{customer.full_name}</td>
                    <td className="py-4 px-4 text-nx-text-sec">{customer.phone}</td>
                    <td className="py-4 px-4 text-nx-text-sec">{customer.email || '-'}</td>
                    <td className="py-4 px-4">
                      <span className="inline-block bg-nx-gold/10 text-nx-gold px-3 py-1 text-xs font-label uppercase tracking-wider">
                        {customer.customer_type}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-nx-text">
                      {new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(customer.credit_limit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-12 text-nx-text-sec">No customers found</p>
        )}
      </div>
    </div>
  )
}
