'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/sync/db'
import { retryQuarantinedMutation, discardQuarantinedMutation } from '@/lib/sync/reconciliation'
import { getOrCreateDeviceId } from '@/lib/sync/device'
import { 
  ShieldAlert, 
  RefreshCw, 
  Trash2, 
  Wifi, 
  WifiOff, 
  Database, 
  Cpu, 
  Search, 
  AlertCircle, 
  CheckCircle,
  Clock,
  UserCheck
} from 'lucide-react'
import { toast } from 'sonner'

export default function SecurityLogPage() {
  const supabase = createClient()
  
  // States
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [deviceKey, setDeviceKey] = useState('')
  const [networkOnline, setNetworkOnline] = useState(true)
  const [queueCount, setQueueCount] = useState(0)

  // Telemetry counts
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [quarantined, setQuarantined] = useState<any[]>([])
  const [filterAction, setFilterAction] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Verify credentials and role (owner only)
  useEffect(() => {
    const verifyAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setIsAdmin(false)
          setLoading(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (profile && profile.role === 'owner') {
          setIsAdmin(true)
        } else {
          setIsAdmin(false)
        }
      } catch (err) {
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }
    verifyAccess()
  }, [])

  // 2. Fetch Logs and Local DB status
  const loadLogsAndQueue = async () => {
    if (!isAdmin) return

    try {
      // Get device ID
      const dKey = await getOrCreateDeviceId()
      setDeviceKey(dKey)

      // Get network
      setNetworkOnline(navigator.onLine)

      // Fetch local queue counts
      const t1 = await db.queue_tier_1.count()
      const t2 = await db.queue_tier_2.count()
      const t3 = await db.queue_tier_3.count()
      setQueueCount(t1 + t2 + t3)

      // Fetch local quarantined mutations
      const localQuarantine = await db.quarantined_mutations.toArray()
      setQuarantined(localQuarantine)

      // Fetch audit logs from server if online
      if (navigator.onLine) {
        const { data: logs, error } = await supabase
          .from('audit_logs')
          .select(`
            id,
            action,
            entity_type,
            entity_id,
            old_value,
            new_value,
            created_at,
            device_id,
            sync_source,
            offline_origin,
            profiles:user_id (full_name, email)
          `)
          .order('created_at', { ascending: false })
          .limit(100)

        if (!error && logs) {
          setAuditLogs(logs)
        }
      }
    } catch (e) {
      console.error('Error fetching security log diagnostics', e)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadLogsAndQueue()
      // Intercept network listeners
      window.addEventListener('online', loadLogsAndQueue)
      window.addEventListener('offline', loadLogsAndQueue)
      return () => {
        window.removeEventListener('online', loadLogsAndQueue)
        window.removeEventListener('offline', loadLogsAndQueue)
      }
    }
  }, [isAdmin])

  // Retry handler
  const handleRetry = async (id: string) => {
    try {
      const res = await retryQuarantinedMutation(id)
      if (res) {
        toast.success('Miamala imerudishwa kwenye mstari wa kusawazisha (Mutation re-queued)')
        loadLogsAndQueue()
      }
    } catch (e) {
      toast.error('Imeshindwa kusindika tena')
    }
  }

  // Discard handler
  const handleDiscard = async (id: string) => {
    if (!confirm('Una uhakika unataka kufuta kabisa muamala huu? Kitendo hiki hakiwezi kurejeshwa.')) return
    try {
      const res = await discardQuarantinedMutation(id)
      if (res) {
        toast.success('Muamala uliofutwa umefutwa kabisa (Quarantined mutation discarded)')
        loadLogsAndQueue()
      }
    } catch (e) {
      toast.error('Imeshindwa kufuta muamala')
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-nx-bg text-nx-text-sec">
        Kupakia mifumo ya usalama (Verifying secure scope)...
      </div>
    )
  }

  if (isAdmin === false) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center text-center bg-nx-bg">
        <ShieldAlert className="w-12 h-12 text-nx-red mb-4" />
        <h3 className="font-ui text-lg font-bold text-gray-900">Upatikanaji Umekatiliwa (Access Denied)</h3>
        <p className="text-sm text-gray-500 mt-2 max-w-sm">
          Sehemu hii inapatikana kwa Mmiliki mkuu pekee wa mfumo (Owner role clearance required).
        </p>
      </div>
    )
  }

  // Formatting currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  // Filter logs
  const filteredLogs = auditLogs.filter(log => {
    const matchesAction = filterAction === 'all' || log.action.toLowerCase() === filterAction.toLowerCase()
    const matchesSearch = !searchQuery || 
                          log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (log.profiles?.full_name && log.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesAction && matchesSearch
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-nx-bg min-h-screen">
      {/* Header zone */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-nx-border pb-5">
        <div>
          <h1 className="font-ui text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-cyan-600" />
            NEXPOS Control Center — Security & Logs
          </h1>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Audit Trails, Immutability Verification, Offline Conflict Reviews, and Device Trust Registry.
          </p>
        </div>
        <button
          onClick={loadLogsAndQueue}
          className="flex items-center justify-center gap-2 py-2 px-4 bg-white border border-nx-border hover:bg-nx-surface text-gray-700 text-xs font-semibold rounded-xl transition-all self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sasisha Sasa (Refresh Diagnostics)
        </button>
      </div>

      {/* Diagnostics Telemetry Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Network Status */}
        <div className="bg-white border border-nx-border p-4 rounded-xl flex items-center gap-4">
          <div className={`p-3 rounded-lg ${networkOnline ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
            {networkOnline ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Hali ya Mtandao</p>
            <p className="font-ui text-sm font-bold text-gray-900 mt-0.5">
              {networkOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        {/* Card 2: Queue Depth */}
        <div className="bg-white border border-nx-border p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-cyan-50 text-cyan-600 rounded-lg">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Mstari wa Sync (Queue)</p>
            <p className="font-ui text-sm font-bold text-gray-900 mt-0.5">
              <span className="font-mono">{queueCount}</span> pending
            </p>
          </div>
        </div>

        {/* Card 3: Quarantine Conflicts */}
        <div className="bg-white border border-nx-border p-4 rounded-xl flex items-center gap-4">
          <div className={`p-3 rounded-lg ${quarantined.length > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Migogoro (Quarantine)</p>
            <p className="font-ui text-sm font-bold text-gray-900 mt-0.5">
              <span className="font-mono">{quarantined.length}</span> conflicts
            </p>
          </div>
        </div>

        {/* Card 4: Device Signature */}
        <div className="bg-white border border-nx-border p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Cpu className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 font-medium">Kitambulisho cha Kifaa</p>
            <p className="font-ui text-xs font-mono font-semibold text-gray-700 mt-1 truncate">
              {deviceKey}
            </p>
          </div>
        </div>
      </div>

      {/* Quarantined Mutation Resolution Section */}
      {quarantined.length > 0 && (
        <div className="bg-red-50/40 border border-red-100 rounded-xl p-5 space-y-4">
          <h2 className="font-ui font-bold text-red-900 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 animate-pulse" />
            Migogoro ya Usawazishaji Nje ya Mtandao (Offline Sync Conflicts Quarantine)
          </h2>
          <p className="text-xs text-red-700 leading-relaxed max-w-3xl">
            Miamala ifuatayo ilikataliwa na seva kwa sababu ya sheria za usalama, haki za ufikiaji au mabadiliko ya data. 
            Tafadhali kagua na ufanye uamuzi (Reconcile).
          </p>

          <div className="divide-y divide-red-100 border border-red-100 bg-white rounded-xl overflow-hidden shadow-sm">
            {quarantined.map((item) => (
              <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold text-[10px] uppercase">
                      {item.type}
                    </span>
                    <span className="font-mono text-gray-500">ID: {item.id}</span>
                  </div>
                  <p className="font-ui font-semibold text-gray-900">
                    SABABU: <span className="text-red-600 font-normal">{item.error}</span>
                  </p>
                  <p className="text-gray-500">
                    Kifaa: <span className="font-mono">{item.device_id.slice(0, 8)}...</span> • Tarehe: {new Date(item.timestamp).toLocaleString('en-TZ')}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
                  <button
                    onClick={() => handleRetry(item.id)}
                    className="flex items-center gap-1 py-1.5 px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold shadow-sm transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Jaribu Tena (Retry)
                  </button>
                  <button
                    onClick={() => handleDiscard(item.id)}
                    className="flex items-center gap-1 py-1.5 px-3 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg font-semibold transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Futa (Discard)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Immutable Audit Log Feed */}
      <div className="bg-white border border-nx-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Table header filter bar */}
        <div className="p-4 border-b border-nx-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <h2 className="font-ui text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-cyan-600" />
            Vifungu vya Usalama na Ukaguzi (Security Audit Trail Feed)
          </h2>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-nx-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tafuta logs..."
                className="pl-8 pr-3 py-1.5 bg-nx-bg border border-nx-border text-xs rounded-lg w-40 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-nx-bg border border-nx-border text-xs rounded-lg py-1.5 px-3 text-gray-700 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">Vitendo Vyote (All Actions)</option>
              <option value="process_refund">Refunds & Returns</option>
              <option value="override_till">Till Overrides</option>
              <option value="dispatch_transfer">Transfers</option>
              <option value="price_override">Pricing Overrides</option>
              <option value="stock_adjustment">Stock Adjustments</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto min-w-full">
          <table className="min-w-full divide-y divide-nx-border">
            <thead className="bg-nx-surface">
              <tr className="text-left text-[11px] text-nx-text-sec uppercase tracking-wider font-semibold">
                <th className="px-6 py-3">Tarehe na Saa</th>
                <th className="px-6 py-3">Mtendaji (Actor)</th>
                <th className="px-6 py-3">Kitendo (Action)</th>
                <th className="px-6 py-3">Chombo (Entity)</th>
                <th className="px-6 py-3">Kifaa (Device)</th>
                <th className="px-6 py-3">Chanzo (Source)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-border text-xs text-gray-700">
              {filteredLogs.map((log) => {
                const isCritical = log.action.includes('OVERRIDE') || log.action.includes('REFUND')
                
                return (
                  <tr key={log.id} className="hover:bg-nx-surface/50">
                    <td className="px-6 py-3 whitespace-nowrap text-gray-500 font-mono">
                      {new Date(log.created_at).toLocaleString('en-TZ')}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{log.profiles?.full_name || 'System Replay'}</div>
                      <div className="text-[10px] text-gray-500">{log.profiles?.email || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isCritical 
                          ? 'bg-red-50 text-red-700 border border-red-100' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="text-gray-900 font-semibold">{log.entity_type}</div>
                      <div className="text-[10px] text-gray-500 font-mono truncate max-w-[120px]">{log.entity_id}</div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap font-mono text-[10px] text-gray-500">
                      {log.device_id ? log.device_id.slice(0, 8) : 'unknown'}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {log.offline_origin ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-orange-600 font-semibold bg-orange-50 px-2 py-0.5 rounded-full">
                            <WifiOff className="w-3 h-3" /> offline
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">
                            <Wifi className="w-3 h-3" /> live
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-ui">
                    Hakuna logs zilizopatikana (No security events recorded matching criteria).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
