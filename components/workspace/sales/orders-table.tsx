'use client'

import React, { useState, useRef } from 'react'
import { StatusPill } from './status-pill'
import { getOperationalStatus } from '@/lib/utils/sales'
import { 
  X, 
  Calendar, 
  User, 
  CreditCard, 
  Check, 
  ChevronRight, 
  FileText, 
  Clock, 
  UserCheck, 
  BadgePercent,
  Receipt,
  ShoppingCart,
  DollarSign
} from 'lucide-react'

interface OrdersTableProps {
  orders: any[]
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onSelectOrder?: (order: any) => void
}

export function OrdersTable({ 
  orders, 
  currentPage, 
  totalPages, 
  onPageChange,
  onSelectOrder
}: OrdersTableProps) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  
  // Drag scrolling state
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [isDown, setIsDown] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    const container = tableContainerRef.current
    if (!container) return
    setIsDown(true)
    setStartX(e.pageX - container.offsetLeft)
    setScrollLeft(container.scrollLeft)
  }

  const handleMouseLeave = () => {
    setIsDown(false)
  }

  const handleMouseUp = () => {
    setIsDown(false)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown) return
    e.preventDefault()
    const container = tableContainerRef.current
    if (!container) return
    const x = e.pageX - container.offsetLeft
    const walk = (x - startX) * 1.5 // drag speed
    container.scrollLeft = scrollLeft - walk
  }

  const handleRowClick = (order: any) => {
    setSelectedOrder(order)
    if (onSelectOrder) onSelectOrder(order)
  }

  // Helper to format currency
  const formatCurrency = (val: any) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(Number(val || 0))
  }

  // Helper to generate dynamic timeline events
  const getTimelineEvents = (order: any) => {
    const events = []
    const dateStr = new Date(order.sale_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    const timeStr = new Date(order.sale_date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })

    // Event 1: Creation
    events.push({
      title: 'Order Created',
      desc: `Receipt ${order.receipt_number} generated at till`,
      time: `${dateStr} · ${timeStr}`,
      status: 'completed'
    })

    const opStatus = getOperationalStatus(order)
    const amountPaid = Number(order.amount_paid || 0)
    const totalAmount = Number(order.total_amount || 0)

    // Event 2: Payment
    if (amountPaid >= totalAmount && opStatus !== 'cancelled') {
      events.push({
        title: 'Full Payment Received',
        desc: `Amount of ${formatCurrency(amountPaid)} settled via ${order.payments?.[0]?.payment_method || 'payment method'}`,
        time: `${dateStr} · ${timeStr}`,
        status: 'completed'
      })
    } else if (amountPaid > 0 && opStatus !== 'cancelled') {
      events.push({
        title: 'Partial Payment Received',
        desc: `${formatCurrency(amountPaid)} paid. Remaining balance: ${formatCurrency(order.balance_due)}`,
        time: `${dateStr} · ${timeStr}`,
        status: 'pending'
      })
    }

    // Event 3: Closure / Cancellation
    if (opStatus === 'cancelled') {
      events.push({
        title: 'Order Cancelled',
        desc: 'Transaction voided by administrator',
        time: `${dateStr} · ${timeStr}`,
        status: 'cancelled'
      })
    } else if (order.status === 'refunded') {
      events.push({
        title: 'Items Refunded',
        desc: 'Refund process executed in returns terminal',
        time: `${dateStr} · ${timeStr}`,
        status: 'refunded'
      })
    } else if (opStatus === 'completed') {
      events.push({
        title: 'Fulfilled & Closed',
        desc: 'Inventory movements locked and order completed',
        time: `${dateStr} · ${timeStr}`,
        status: 'completed'
      })
    }

    return events
  }

  return (
    <>
      <div className="bg-nx-surface border border-nx-border rounded-nx-card overflow-hidden flex flex-col relative select-none">
        {/* Table wrapper with drag support */}
        <div 
          ref={tableContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`overflow-x-auto no-scrollbar cursor-grab ${isDown ? 'cursor-grabbing' : ''}`}
        >
          <table className="w-full border-collapse text-left min-w-[900px] table-layout-fixed">
            <thead>
              <tr className="bg-nx-elevated/70 border-b border-nx-border">
                {/* Sticky Column */}
                <th className="sticky left-0 bg-nx-elevated/90 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-20 w-[140px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                  Receipt #
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10">
                  Customer
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10">
                  Cashier
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[120px]">
                  Status
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[150px]">
                  Payment Method
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[120px] text-right">
                  Time
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nx-text-sec border-b border-nx-border z-10 w-[140px] text-right">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-border/50">
              {orders.length > 0 ? (
                orders.map((order) => {
                  const payMethod = order.payments?.[0]?.payment_method || 'N/A'
                  const payMethodFormatted = payMethod.replace('_', ' ')
                  const opStatus = getOperationalStatus(order)
                  
                  return (
                    <tr 
                      key={order.id} 
                      onClick={() => handleRowClick(order)}
                      className="hover:bg-nx-hover/40 transition-colors duration-150 cursor-pointer active:bg-nx-hover"
                    >
                      {/* Sticky Receipt Column */}
                      <td className="sticky left-0 bg-nx-surface font-data text-[12px] font-bold text-nx-cyan px-4 py-3 border-r border-nx-border/30 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        {order.receipt_number}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-nx-text font-medium truncate max-w-[150px]">
                        {order.customer?.full_name || 'Walk-in Customer'}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-nx-text-sec truncate max-w-[150px]">
                        {order.cashier?.full_name || 'System'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={opStatus} />
                      </td>
                      <td className="px-4 py-3 text-[12px] text-nx-text-sec font-medium capitalize">
                        {payMethodFormatted}
                      </td>
                      <td className="px-4 py-3 font-data text-[12px] text-nx-text-sec text-right">
                        {new Date(order.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-data text-[12px] font-bold text-nx-text text-right">
                        {formatCurrency(order.total_amount)}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[13px] text-nx-text-muted font-ui">
                    No matching transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Compact Table Padding and styling under 1024px */}
        <style jsx global>{`
          @media (max-width: 1024px) {
            table th, table td {
              padding-top: 0.5rem !important;
              padding-bottom: 0.5rem !important;
              padding-left: 0.75rem !important;
              padding-right: 0.75rem !important;
              font-size: 12px !important;
            }
          }
        `}</style>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-nx-border bg-nx-elevated/30 flex items-center justify-between z-10 shrink-0">
            <span className="text-[12px] text-nx-text-muted font-ui">
              Page <span className="font-semibold text-nx-text">{currentPage}</span> of <span className="font-semibold text-nx-text">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-nx-surface border border-nx-border rounded-nx-xs text-[12px] font-medium text-nx-text hover:bg-nx-hover disabled:opacity-50 disabled:pointer-events-none transition-colors active:scale-95"
              >
                Previous
              </button>
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-nx-surface border border-nx-border rounded-nx-xs text-[12px] font-medium text-nx-text hover:bg-nx-hover disabled:opacity-50 disabled:pointer-events-none transition-colors active:scale-95"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Side Details Drawer */}
      {selectedOrder && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setSelectedOrder(null)}
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-50 transition-opacity"
          />

          {/* Sliding Panel */}
          <div className="fixed top-0 right-0 h-full w-full max-w-[460px] bg-nx-surface border-l border-nx-border shadow-[0_0_24px_rgba(0,0,0,0.15)] z-50 flex flex-col transform transition-transform duration-300 ease-out translate-x-0 font-ui">
            {/* Drawer Header */}
            <div className="p-5 border-b border-nx-border flex items-center justify-between bg-nx-elevated/40">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-nx-cyan" />
                <div>
                  <h3 className="font-semibold text-[15px] text-nx-text">Transaction Details</h3>
                  <span className="font-data text-[12px] text-nx-text-sec">{selectedOrder.receipt_number}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 hover:bg-nx-hover border border-transparent hover:border-nx-border rounded-nx-xs text-nx-text-sec transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status Banner */}
              <div className="flex items-center justify-between p-4 bg-nx-elevated border border-nx-border rounded-nx-card">
                <span className="text-[12px] text-nx-text-sec font-medium">Operational Pipeline</span>
                <StatusPill status={getOperationalStatus(selectedOrder)} />
              </div>

              {/* General Metadata */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Metadata</h4>
                <div className="grid grid-cols-2 gap-4 text-[13px] bg-nx-elevated/20 p-4 border border-nx-border/50 rounded-nx-card">
                  <div className="space-y-1">
                    <span className="text-nx-text-muted text-[11px] flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Date</span>
                    <p className="font-medium text-nx-text">
                      {new Date(selectedOrder.sale_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-nx-text-muted text-[11px] flex items-center gap-1.5"><Clock className="w-3 h-3" /> Time</span>
                    <p className="font-data text-[12px] font-medium text-nx-text">
                      {new Date(selectedOrder.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-nx-text-muted text-[11px] flex items-center gap-1.5"><User className="w-3 h-3" /> Customer</span>
                    <p className="font-medium text-nx-text truncate">
                      {selectedOrder.customer?.full_name || 'Walk-in Customer'}
                    </p>
                    {selectedOrder.customer?.phone && (
                      <p className="font-data text-[11px] text-nx-text-sec">{selectedOrder.customer.phone}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="text-nx-text-muted text-[11px] flex items-center gap-1.5"><UserCheck className="w-3 h-3" /> Cashier</span>
                    <p className="font-medium text-nx-text truncate">
                      {selectedOrder.cashier?.full_name || 'System'}
                    </p>
                    {selectedOrder.cashier?.role && (
                      <p className="text-[10px] bg-nx-cyan/10 text-nx-cyan px-1.5 py-0.5 rounded font-semibold inline-block uppercase tracking-wider">
                        {selectedOrder.cashier.role}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-nx-text-muted" /> Itemized List
                </h4>
                <div className="border border-nx-border rounded-nx-card overflow-hidden">
                  <div className="bg-nx-elevated px-4 py-2 border-b border-nx-border grid grid-cols-[1fr_80px_100px] text-[11px] font-semibold text-nx-text-sec">
                    <span>Product</span>
                    <span className="text-center">Qty</span>
                    <span className="text-right">Subtotal</span>
                  </div>
                  <div className="divide-y divide-nx-border/50 max-h-[220px] overflow-y-auto">
                    {selectedOrder.sale_items && selectedOrder.sale_items.length > 0 ? (
                      selectedOrder.sale_items.map((item: any) => (
                        <div key={item.id} className="px-4 py-3 grid grid-cols-[1fr_80px_100px] items-center text-[13px]">
                          <div className="min-w-0 pr-2">
                            <p className="font-medium text-nx-text truncate">
                              {item.variant?.family?.name || 'Standard Shoe'}
                            </p>
                            <p className="text-[11px] text-nx-text-sec flex gap-1">
                              {item.variant?.size && <span>Size: {item.variant.size}</span>}
                              {item.variant?.color && <span>· Color: {item.variant.color}</span>}
                            </p>
                          </div>
                          <span className="font-data text-[12px] text-center text-nx-text-sec">
                            {item.quantity}
                          </span>
                          <span className="font-data text-[12px] text-right font-semibold text-nx-text">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-4 text-center text-[12px] text-nx-text-muted">
                        No item records attached
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial Breakdowns */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Financial Breakdowns</h4>
                <div className="bg-nx-elevated/30 border border-nx-border p-4 rounded-nx-card space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-nx-text-sec">Subtotal</span>
                    <span className="font-data text-nx-text">{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  {Number(selectedOrder.discount_amount || 0) > 0 && (
                    <div className="flex justify-between text-nx-red">
                      <span className="flex items-center gap-1.5"><BadgePercent className="w-3.5 h-3.5" /> Discount</span>
                      <span className="font-data">- {formatCurrency(selectedOrder.discount_amount)}</span>
                    </div>
                  )}
                  <div className="border-t border-nx-border my-2 pt-2 flex justify-between font-semibold text-nx-text">
                    <span>Total Amount</span>
                    <span className="font-data text-nx-cyan">{formatCurrency(selectedOrder.total_amount)}</span>
                  </div>
                  <div className="border-t border-dashed border-nx-border/60 pt-2 flex justify-between text-[12px]">
                    <span className="text-nx-text-muted flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Amount Paid</span>
                    <span className="font-data font-medium text-nx-text">{formatCurrency(selectedOrder.amount_paid)}</span>
                  </div>
                  {Number(selectedOrder.balance_due || 0) > 0 && (
                    <div className="flex justify-between text-[12px] text-nx-orange">
                      <span>Balance Due</span>
                      <span className="font-data font-bold">{formatCurrency(selectedOrder.balance_due)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Operational Activity Timeline */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-bold text-nx-text-muted uppercase tracking-wider">Activity Timeline</h4>
                <div className="relative pl-6 space-y-5 border-l border-nx-border/80 ml-2.5">
                  {getTimelineEvents(selectedOrder).map((evt, idx) => (
                    <div key={idx} className="relative">
                      {/* Circle indicator */}
                      <span className={`absolute -left-[31px] top-0.5 w-[11px] h-[11px] rounded-full border-2 bg-nx-surface ${
                        evt.status === 'completed' ? 'border-nx-green' : 
                        evt.status === 'pending' ? 'border-nx-orange' : 
                        evt.status === 'cancelled' ? 'border-nx-red' : 'border-nx-text-muted'
                      }`} />
                      
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-semibold text-nx-text">{evt.title}</span>
                          <span className="text-[10px] text-nx-text-muted font-data">{evt.time}</span>
                        </div>
                        <p className="text-[12px] text-nx-text-sec leading-relaxed">{evt.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
