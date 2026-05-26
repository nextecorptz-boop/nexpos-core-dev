'use client'

import React, { useEffect, useState } from 'react'
import { db, type TelemetryLog, type QuarantinedMutation } from '@/lib/sync/db'
import { useSyncStatus } from '@/lib/sync/use-sync-status'
import { retryQuarantinedMutation, discardQuarantinedMutation } from '@/lib/sync/reconciliation'
import { runStartupIntegrityChecks, type IntegrityResult } from '@/lib/db/startup-checks'
import { ProjectionManager, PROJECTION_VERSION, PROJECTION_CHECKSUM } from '@/lib/sync/projections'
import { LedgerAuditor, type AuditReport } from '@/lib/sync/ledger-auditor'
import { ShieldAlert, RefreshCw, Trash2, Cpu, Database, AlertTriangle, Layers, Activity, FileText, CheckCircle, HelpCircle, HardDrive } from 'lucide-react'

export function TelemetryDashboard() {
  const { isOnline, pendingCount, failedCount, queue, triggerSync } = useSyncStatus()
  const [logs, setLogs] = useState<TelemetryLog[]>([])
  const [quarantined, setQuarantined] = useState<QuarantinedMutation[]>([])
  const [diagnostics, setDiagnostics] = useState<IntegrityResult | null>(null)
  const [activeTab, setActiveTab] = useState<'logs' | 'quarantine' | 'system' | 'events'>('logs')
  const [isLoading, setIsLoading] = useState(false)
  const [benchmarkResult, setBenchmarkResult] = useState<any>(null)
  const [isBenchmarking, setIsBenchmarking] = useState(false)
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [rebuildResult, setRebuildResult] = useState<string | null>(null)
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null)
  const [isAuditing, setIsAuditing] = useState(false)
  const [deviceId, setDeviceId] = useState<string>('')
  const [fingerprint, setFingerprint] = useState<string>('')
  const [cert, setCert] = useState<any>(null)
  const [nonce, setNonce] = useState<number>(0)
  const [peers, setPeers] = useState<any[]>([])
  const [meshStatus, setMeshStatus] = useState<any>(null)
  const [networkStatus, setNetworkStatus] = useState<any>(null)
  const [isRotating, setIsRotating] = useState(false)
  const [rotationResult, setRotationResult] = useState<string>('')

  const loadSecurityStatus = async () => {
    try {
      const { getOrCreateDeviceKeys } = await import('@/lib/security/device-crypto');
      const { getLocalCertificate } = await import('@/lib/security/device-certificates');
      const { getDeviceFingerprint } = await import('@/lib/security/device-identity');
      const { listTrustRegistry } = await import('@/lib/security/device-registry');
      const { meshManager } = await import('@/lib/sync/mesh');
      const { networkMonitor } = await import('@/lib/sync/network');
      
      const keys = await getOrCreateDeviceKeys();
      setDeviceId(keys.deviceId);
      
      const fp = await getDeviceFingerprint();
      setFingerprint(fp);
      
      const localCert = await getLocalCertificate(keys.deviceId);
      setCert(localCert);

      const nonceRec = await db.settings.get('device_signature_nonce');
      setNonce(nonceRec ? Number(nonceRec.value) : 0);

      const registry = await listTrustRegistry();
      setPeers(registry);

      setMeshStatus(meshManager.getStatus());
      setNetworkStatus(await networkMonitor.getStatus());
    } catch (e) {
      console.error('Failed to load security status:', e);
    }
  }

  const handleKeyRotation = async () => {
    setIsRotating(true);
    setRotationResult('');
    try {
      const { rotateDeviceKeys } = await import('@/lib/security/key-rotation');
      const newCert = await rotateDeviceKeys('tenant-a');
      setRotationResult(`Key rotated successfully! Expires: ${new Date(newCert.expiresAt).toLocaleDateString()}`);
      await loadSecurityStatus();
    } catch (err: any) {
      console.error('Key rotation failed:', err);
      setRotationResult(`Rotation failed: ${err.message || err}`);
    }
    setIsRotating(false);
  };

  const handleRunAudit = async () => {
    setIsAuditing(true);
    setAuditReport(null);
    try {
      const allEvents = queue.map(q => q.payload).filter(p => p && p.event_type);
      const report = await LedgerAuditor.auditLocalLedger(allEvents);
      setAuditReport(report);
    } catch (e: any) {
      console.error('Audit failed:', e);
      setAuditReport({
        timestamp: new Date().toISOString(),
        totalEventsChecked: 0,
        missingEventsCount: 0,
        driftsCount: 0,
        details: [`Audit failed: ${e.message || e}`],
        passed: false
      });
    }
    setIsAuditing(false);
  };

  const handleProjectionRebuild = async () => {
    setIsRebuilding(true);
    setRebuildResult(null);
    try {
      const allEvents = queue.map(q => q.payload).filter(p => p && p.event_type);
      const start = performance.now();
      await ProjectionManager.executeFullReplay(allEvents);
      const elapsed = performance.now() - start;
      setRebuildResult(`Rebuild completed successfully in ${elapsed.toFixed(1)}ms. Active checksum: ${PROJECTION_CHECKSUM}`);
      await runDiagnostics();
    } catch (e: any) {
      console.error('Rebuild failed:', e);
      setRebuildResult(`Rebuild failed: ${e.message || e}`);
    }
    setIsRebuilding(false);
  };

  const loadLocalLogs = async () => {
    try {
      if (db.isOpen() && db.telemetry_logs) {
        const localLogs = await db.telemetry_logs
          .orderBy('timestamp')
          .reverse()
          .limit(100)
          .toArray()
        setLogs(localLogs)
      }
    } catch (e) {
      console.error('Failed to load telemetry logs:', e)
    }
  }

  const loadQuarantined = async () => {
    try {
      if (db.isOpen() && db.quarantined_mutations) {
        const qList = await db.quarantined_mutations.toArray()
        setQuarantined(qList)
      }
    } catch (e) {
      console.error('Failed to load quarantined mutations:', e)
    }
  }

  const runDiagnostics = async () => {
    const checks = await runStartupIntegrityChecks()
    setDiagnostics(checks)
  }

  useEffect(() => {
    loadLocalLogs()
    loadQuarantined()
    runDiagnostics()
    loadSecurityStatus()

    // Setup refresh interval
    const interval = setInterval(() => {
      loadLocalLogs()
      loadQuarantined()
      loadSecurityStatus()
    }, 5000)

    // Listen for custom events
    const handleQueueChange = () => {
      loadQuarantined()
    }
    window.addEventListener('nx-sync-queue-updated', handleQueueChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('nx-sync-queue-updated', handleQueueChange)
    }
  }, [])

  const handleRetryQuarantine = async (id: string) => {
    setIsLoading(true)
    const success = await retryQuarantinedMutation(id)
    if (success) {
      await loadQuarantined()
      triggerSync()
    }
    setIsLoading(false)
  }

  const handleDiscardQuarantine = async (id: string) => {
    setIsLoading(true)
    const success = await discardQuarantinedMutation(id)
    if (success) {
      await loadQuarantined()
    }
    setIsLoading(false)
  }

  const handleClearIsolatedStatus = async () => {
    await db.settings.delete('client_status')
    await db.settings.put({ key: 'last_successful_sync', value: new Date().toISOString() })
    await runDiagnostics()
    window.location.reload()
  }

  const runBenchmark = async () => {
    setIsBenchmarking(true)
    setBenchmarkResult(null)
    try {
      // Lazy load benchmark to avoid bundle overhead
      const { runPerformanceBenchmark } = await import('@/tests/performance-benchmark')
      const result = await runPerformanceBenchmark()
      setBenchmarkResult(result)
    } catch (err: any) {
      setBenchmarkResult({ error: err.message || 'Benchmark run failed' })
    }
    setIsBenchmarking(false)
  }

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0
    }).format(val)
  }

  return (
    <div className="bg-nx-surface border border-nx-border rounded-nx-card p-6 flex flex-col gap-6 select-none shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-nx-border pb-4">
        <div>
          <h2 className="text-[16px] font-bold text-nx-text flex items-center gap-2">
            <Cpu className="w-5 h-5 text-nx-cyan" />
            Enterprise Infrastructure & Telemetry Diagnostics
          </h2>
          <p className="text-[11px] text-nx-text-sec mt-1">
            Real-time IndexedDB persistence stats, local telemetry logs, and sync quarantine controls.
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              runDiagnostics()
              loadLocalLogs()
              loadQuarantined()
            }}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 border border-nx-border hover:bg-nx-hover text-nx-text font-semibold text-[11.5px] px-3.5 py-2 rounded-nx-btn transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Feed
          </button>

          {diagnostics?.isolated && (
            <button
              onClick={handleClearIsolatedStatus}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-nx-cyan hover:bg-nx-cyan/90 text-white font-semibold text-[11.5px] px-3.5 py-2 rounded-nx-btn transition-all"
            >
              Reset Isolation state
            </button>
          )}
        </div>
      </div>

      {/* SLA / Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-nx-elevated border border-nx-border p-4 rounded-nx-card">
          <div className="flex items-center justify-between text-nx-text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">Sync State</span>
            <Layers className="w-4 h-4 text-nx-cyan" />
          </div>
          <h4 className="font-bold text-[18px] text-nx-text mt-2">
            {isOnline ? 'Online (SLA Active)' : 'Offline Mode'}
          </h4>
          <p className="text-[10px] text-nx-text-sec mt-1">
            {pendingCount} pending queue | {failedCount} retry actions
          </p>
        </div>

        <div className="bg-nx-elevated border border-nx-border p-4 rounded-nx-card">
          <div className="flex items-center justify-between text-nx-text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">Local Health Status</span>
            <Database className="w-4 h-4 text-nx-green" />
          </div>
          <h4 className="font-bold text-[18px] text-nx-text mt-2 flex items-center gap-1.5">
            {diagnostics?.healthy ? (
              <span className="text-nx-green">Healthy</span>
            ) : diagnostics?.isolated ? (
              <span className="text-nx-red">Isolated</span>
            ) : (
              <span className="text-nx-gold">Warning</span>
            )}
          </h4>
          <p className="text-[10px] text-nx-text-sec mt-1">
            Storage: {diagnostics?.diagnostics.storageUsageMb || 0}MB used
          </p>
        </div>

        <div className="bg-nx-elevated border border-nx-border p-4 rounded-nx-card">
          <div className="flex items-center justify-between text-nx-text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">Telemetry Logs</span>
            <FileText className="w-4 h-4 text-nx-cyan" />
          </div>
          <h4 className="font-bold text-[18px] font-data text-nx-text mt-2">
            {logs.length}
          </h4>
          <p className="text-[10px] text-nx-text-sec mt-1">
            Active buffer: max 1000 items
          </p>
        </div>

        <div className="bg-nx-elevated border border-nx-border p-4 rounded-nx-card">
          <div className="flex items-center justify-between text-nx-text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">Quarantined Mutations</span>
            <AlertTriangle className="w-4 h-4 text-nx-red" />
          </div>
          <h4 className={`font-bold text-[18px] font-data mt-2 ${quarantined.length > 0 ? 'text-nx-red animate-pulse' : 'text-nx-text'}`}>
            {quarantined.length}
          </h4>
          <p className="text-[10px] text-nx-text-sec mt-1">
            Requires administrator audit
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-nx-border pb-1">
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-2.5 px-4 font-semibold text-[12px] border-b-2 transition-all ${
            activeTab === 'logs' ? 'border-nx-cyan text-nx-text' : 'border-transparent text-nx-text-sec hover:text-nx-text'
          }`}
        >
          Telemetry Feed ({logs.length})
        </button>
        <button
          onClick={() => setActiveTab('quarantine')}
          className={`pb-2.5 px-4 font-semibold text-[12px] border-b-2 transition-all relative ${
            activeTab === 'quarantine' ? 'border-nx-cyan text-nx-text' : 'border-transparent text-nx-text-sec hover:text-nx-text'
          }`}
        >
          Quarantined Mutations ({quarantined.length})
          {quarantined.length > 0 && (
            <span className="absolute top-1.5 right-0.5 bg-nx-red w-2 h-2 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`pb-2.5 px-4 font-semibold text-[12px] border-b-2 transition-all ${
            activeTab === 'system' ? 'border-nx-cyan text-nx-text' : 'border-transparent text-nx-text-sec hover:text-nx-text'
          }`}
        >
          Device Diagnostics & Benchmarking
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`pb-2.5 px-4 font-semibold text-[12px] border-b-2 transition-all ${
            activeTab === 'events' ? 'border-nx-cyan text-nx-text' : 'border-transparent text-nx-text-sec hover:text-nx-text'
          }`}
        >
          Event Store & Ledger
        </button>
        <button
          onClick={() => setActiveTab('mesh' as any)}
          className={`pb-2.5 px-4 font-semibold text-[12px] border-b-2 transition-all ${
            activeTab === ('mesh' as any) ? 'border-nx-cyan text-nx-text' : 'border-transparent text-nx-text-sec hover:text-nx-text'
          }`}
        >
          Mesh & Adaptive Sync
        </button>
        <button
          onClick={() => setActiveTab('security' as any)}
          className={`pb-2.5 px-4 font-semibold text-[12px] border-b-2 transition-all ${
            activeTab === ('security' as any) ? 'border-nx-cyan text-nx-text' : 'border-transparent text-nx-text-sec hover:text-nx-text'
          }`}
        >
          Security & Trust Mesh
        </button>
      </div>

      {/* Tab: Mesh & Adaptive Sync */}
      {activeTab === ('mesh' as any) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[300px]">
          {/* Mesh Leadership Panel */}
          <div className="space-y-4">
            <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border pb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-nx-cyan" />
              Branch Mesh Topology & Leadership
            </h3>

            {meshStatus && (
              <div className="bg-nx-elevated/40 border border-nx-border p-5 rounded-nx-card space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-nx-text-sec font-semibold">Leadership Role</span>
                  {meshStatus.isLeader ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-nx-green/10 text-nx-green border border-nx-green/20 uppercase tracking-wider">
                      Branch Leader
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-nx-elevated text-nx-text-sec border border-nx-border uppercase tracking-wider">
                      Peer Node
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center text-[12px]">
                  <span className="text-nx-text-sec">Current Election Term</span>
                  <span className="font-data font-bold text-nx-text">{meshStatus.term}</span>
                </div>

                <div className="flex justify-between items-center text-[12px]">
                  <span className="text-nx-text-sec">Active Peer Count</span>
                  <span className="font-data font-bold text-nx-cyan">{meshStatus.peerCount} devices</span>
                </div>

                <div className="space-y-2 mt-4">
                  <span className="text-[10px] uppercase font-bold text-nx-text-sec tracking-widest">Visible Branch Peers</span>
                  <div className="max-h-[150px] overflow-y-auto space-y-2">
                    {meshStatus.peers.map((peer: any) => (
                      <div key={peer.id} className="flex justify-between items-center p-2 bg-nx-surface border border-nx-border rounded text-[10.5px]">
                        <span className="font-data text-nx-text-sec">{peer.id.slice(0, 12)}...</span>
                        <div className="flex gap-2">
                          {peer.isLeader && <span className="text-nx-gold font-bold">LEADER</span>}
                          <span className="text-nx-text font-semibold">POS</span>
                        </div>
                      </div>
                    ))}
                    {meshStatus.peers.length === 0 && (
                      <p className="text-[10px] text-nx-text-muted italic py-2">Searching for local peers...</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Adaptive Sync & Network Panel */}
          <div className="space-y-4">
            <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border pb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-nx-cyan" />
              Adaptive Sync Quality (RTT-Aware)
            </h3>

            {networkStatus && (
              <div className="bg-nx-elevated/40 border border-nx-border p-5 rounded-nx-card space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-nx-text-sec font-semibold">Network Quality</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    networkStatus.quality === 'excellent' ? 'bg-nx-green/10 text-nx-green border border-nx-green/20' :
                    networkStatus.quality === 'good' ? 'bg-nx-cyan/10 text-nx-cyan border border-nx-cyan/20' :
                    networkStatus.quality === 'fair' ? 'bg-nx-gold/10 text-nx-gold border border-nx-gold/20' :
                    'bg-nx-red/10 text-nx-red border border-nx-red/20'
                  }`}>
                    {networkStatus.quality}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-nx-surface border border-nx-border p-3 rounded">
                    <span className="text-[9px] uppercase font-bold text-nx-text-muted">Avg RTT</span>
                    <div className="text-[14px] font-data font-bold text-nx-text">{networkStatus.rtt.toFixed(0)} ms</div>
                  </div>
                  <div className="bg-nx-surface border border-nx-border p-3 rounded">
                    <span className="text-[9px] uppercase font-bold text-nx-text-muted">Effective</span>
                    <div className="text-[14px] font-data font-bold text-nx-text uppercase">{networkStatus.effectiveType}</div>
                  </div>
                  <div className="bg-nx-surface border border-nx-border p-3 rounded">
                    <span className="text-[9px] uppercase font-bold text-nx-text-muted">Battery</span>
                    <div className="text-[14px] font-data font-bold text-nx-text">
                      {(networkStatus.batteryLevel * 100).toFixed(0)}%
                      {networkStatus.isCharging && <span className="text-[10px] text-nx-green ml-1">⚡</span>}
                    </div>
                  </div>
                  <div className="bg-nx-surface border border-nx-border p-3 rounded">
                    <span className="text-[9px] uppercase font-bold text-nx-text-muted">Adaptive Mode</span>
                    <div className="text-[14px] font-bold text-nx-cyan">ENABLED</div>
                  </div>
                </div>

                <div className="p-3 bg-nx-gold/5 border border-nx-gold/20 rounded text-[10.5px] leading-relaxed text-nx-text-sec">
                  <span className="font-bold text-nx-gold">Active Strategy: </span>
                  {networkStatus.quality === 'poor' ? 'Aggressive batch reduction (1 item/sync) and increased P3 throttling.' :
                   networkStatus.quality === 'fair' ? 'Moderate batch size (5-10 items) and P3 background delay.' :
                   'Full performance syncing (20-50 items/batch) enabled.'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Logs Feed */}
      {activeTab === 'logs' && (
        <div className="flex flex-col gap-3 min-h-[300px]">
          <div className="overflow-x-auto max-h-[400px] border border-nx-border rounded-nx-card">
            <table className="w-full text-[11.5px] text-left border-collapse select-text">
              <thead>
                <tr className="bg-nx-elevated text-nx-text-sec font-bold border-b border-nx-border">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Level</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Event Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nx-border/50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-nx-elevated/40 transition-colors">
                    <td className="p-3 font-data text-nx-text-sec whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-3 font-semibold whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase ${
                        log.level === 'critical' ? 'bg-red-500/10 text-red-600 border border-red-200' :
                        log.level === 'error' ? 'bg-orange-500/10 text-orange-600' :
                        log.level === 'warn' ? 'bg-yellow-500/10 text-yellow-600' :
                        'bg-blue-500/10 text-blue-600'
                      }`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="p-3 uppercase tracking-wider text-[10px] font-bold text-nx-cyan">
                      {log.category}
                    </td>
                    <td className="p-3 font-medium text-nx-text leading-relaxed">
                      {log.message}
                      {log.details && (
                        <pre className="text-[10px] font-data bg-nx-elevated border border-nx-border/80 rounded p-2 mt-2 max-w-full overflow-x-auto text-nx-text-sec">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center p-8 text-nx-text-muted">
                      No local logs recorded. Sync active to populate feed.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Quarantined */}
      {activeTab === 'quarantine' && (
        <div className="flex flex-col gap-4 min-h-[300px]">
          {quarantined.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-nx-card p-4 flex gap-2.5 items-start">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-[13px]">Conflict Quarantine Queue Active</h4>
                <p className="text-[11.5px] mt-1 leading-relaxed opacity-90">
                  Transactions are quarantined when validation, constraints, or permission RLS checks fail on the server.
                  This protects database consistency. Review the payloads below, correct database conflicts on the dashboard, and select **Retry** or **Discard**.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {quarantined.map((item) => (
              <div key={item.id} className="border border-nx-border rounded-nx-card p-4 space-y-4 hover:border-nx-cyan/50 transition-all select-text">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase bg-red-100 text-red-700">
                      {item.type} Mutation
                    </span>
                    <h4 className="font-bold text-[13px] text-nx-text mt-1.5">
                      Failed: {item.error}
                    </h4>
                    <p className="text-[10px] text-nx-text-sec mt-1">
                      Mutation ID: <span className="font-data">{item.id}</span> | Time: {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={isLoading}
                      onClick={() => handleRetryQuarantine(item.id)}
                      className="flex items-center gap-1.5 bg-nx-cyan hover:bg-nx-cyan/90 text-white font-semibold text-[11px] px-3 py-1.5 rounded transition-transform active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Sync
                    </button>
                    <button
                      disabled={isLoading}
                      onClick={() => handleDiscardQuarantine(item.id)}
                      className="flex items-center gap-1.5 border border-red-200 hover:bg-red-50 text-red-600 font-semibold text-[11px] px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Discard
                    </button>
                  </div>
                </div>

                <div className="bg-nx-elevated border border-nx-border rounded-nx-card p-3 font-data text-[10.5px]">
                  <div className="font-bold text-nx-text-sec uppercase text-[9px] mb-2">Mutation Payload:</div>
                  <pre className="text-nx-text leading-relaxed overflow-x-auto max-w-full">
                    {JSON.stringify(item.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ))}

            {quarantined.length === 0 && (
              <div className="text-center py-12 text-nx-text-muted border border-nx-border/50 rounded-nx-card bg-nx-elevated/30 flex flex-col items-center justify-center gap-3">
                <CheckCircle className="w-8 h-8 text-nx-green" />
                <div>
                  <h4 className="font-bold text-[13.5px] text-nx-text">No Quarantined Transactions</h4>
                  <p className="text-[11px] text-nx-text-sec mt-0.5">Database consistency is fully aligned.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: System & Benchmarks */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[300px]">
          {/* Device diagnostics info */}
          <div className="space-y-4">
            <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border pb-2 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-nx-cyan" />
              Terminal Information
            </h3>

            <div className="space-y-3 text-[12.5px]">
              <div className="flex justify-between items-center py-1 border-b border-nx-border/40">
                <span className="text-nx-text-sec">Approximate Device Memory (RAM)</span>
                <span className="font-data font-bold text-nx-text">
                  {diagnostics?.diagnostics.memoryGb === 'unknown' ? 'Unknown' : `${diagnostics?.diagnostics.memoryGb} GB`}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-nx-border/40">
                <span className="text-nx-text-sec">IndexedDB Storage Allocated</span>
                <span className="font-data font-bold text-nx-text">
                  {diagnostics?.diagnostics.storageQuotaMb} MB
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-nx-border/40">
                <span className="text-nx-text-sec">IndexedDB Storage Currently Used</span>
                <span className="font-data font-bold text-nx-text">
                  {diagnostics?.diagnostics.storageUsageMb} MB
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-nx-border/40">
                <span className="text-nx-text-sec">IndexedDB Database Scope status</span>
                <span className="font-semibold text-nx-green flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> OPEN
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-nx-border/40">
                <span className="text-nx-text-sec">Days Since Last Server Sync</span>
                <span className="font-data font-bold text-nx-text">
                  {diagnostics?.diagnostics.syncAgeDays} days
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-nx-border/40">
                <span className="text-nx-text-sec">Client Device Isolation State</span>
                <span className={`font-bold capitalize ${diagnostics?.isolated ? 'text-nx-red animate-pulse' : 'text-nx-green'}`}>
                  {diagnostics?.diagnostics.clientStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Local Scale Benchmarking */}
          <div className="bg-nx-elevated/40 border border-nx-border rounded-nx-card p-5 space-y-4">
            <div>
              <h3 className="font-bold text-[13.5px] text-nx-text flex items-center gap-2">
                <Activity className="w-4 h-4 text-nx-cyan" />
                Local Hardware Scale Benchmarking
              </h3>
              <p className="text-[10.5px] text-nx-text-sec mt-1">
                Run local simulation (up to 100k mock catalog products) to test POS catalog lookup latency and memory bounds.
              </p>
            </div>

            <button
              onClick={runBenchmark}
              disabled={isBenchmarking}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-nx-btn text-[12px] font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
            >
              {isBenchmarking ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running Benchmarks (Running...)
                </>
              ) : (
                'Execute Scale Benchmark'
              )}
            </button>

            {benchmarkResult && (
              <div className="bg-nx-surface border border-nx-border rounded-nx-card p-4 space-y-3 font-data text-[11px] leading-relaxed select-text">
                {benchmarkResult.error ? (
                  <div className="text-nx-red">Error: {benchmarkResult.error}</div>
                ) : (
                  <>
                    <div className="font-bold text-nx-cyan border-b border-nx-border pb-1 text-[12px]">BENCHMARK RESULTS:</div>
                    <div className="flex justify-between">
                      <span>Mock Catalog Size:</span>
                      <span className="font-bold text-nx-text">{benchmarkResult.catalogSize} products</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fuzzy Search Latency:</span>
                      <span className={`font-bold ${benchmarkResult.searchLatencyMs <= 10 ? 'text-nx-green' : 'text-nx-gold'}`}>
                        {benchmarkResult.searchLatencyMs.toFixed(2)} ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Query Throughput:</span>
                      <span className="font-bold text-nx-text">{benchmarkResult.throughputPerSec} queries/sec</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Peak IndexedDB Write Rate:</span>
                      <span className="font-bold text-nx-text">{benchmarkResult.writeRatePerSec} items/sec</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hardware Performance Tier:</span>
                      <span className="font-bold text-nx-green uppercase">{benchmarkResult.devicePerformanceTier}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Event Store & Ledger Replay */}
      {activeTab === 'events' && (
        <div className="flex flex-col gap-6 min-h-[300px]">
          {/* Operations Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Replay Controls & Versioning */}
            <div className="border border-nx-border rounded-nx-card p-5 space-y-4">
              <h3 className="font-bold text-[13.5px] text-nx-text flex items-center gap-2">
                <Database className="w-4.5 h-4.5 text-nx-cyan" />
                Projection Replay Manager
              </h3>

              <div className="space-y-3 text-[12px]">
                <div className="flex justify-between border-b border-nx-border/50 pb-2">
                  <span className="text-nx-text-sec">Active Projection Version</span>
                  <span className="font-bold font-data text-nx-text">{PROJECTION_VERSION}</span>
                </div>
                <div className="flex justify-between border-b border-nx-border/50 pb-2">
                  <span className="text-nx-text-sec">Schema Checksum</span>
                  <span className="font-bold font-data text-nx-cyan">{PROJECTION_CHECKSUM}</span>
                </div>
                <div className="flex justify-between border-b border-nx-border/50 pb-2">
                  <span className="text-nx-text-sec">Total Cached Replay Queue</span>
                  <span className="font-bold font-data text-nx-text">{queue.length} events</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  disabled={isRebuilding}
                  onClick={handleProjectionRebuild}
                  className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-nx-btn text-[12px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRebuilding ? 'animate-spin' : ''}`} />
                  Execute Full Cold Replay
                </button>
              </div>

              {rebuildResult && (
                <div className="p-3 bg-nx-elevated border border-nx-border rounded text-[11px] font-data text-nx-text-sec leading-relaxed select-text">
                  {rebuildResult}
                </div>
              )}
            </div>

            {/* Audit & Integrity Status Panel */}
            <div className="border border-nx-border rounded-nx-card p-5 space-y-4">
              <h3 className="font-bold text-[13.5px] text-nx-text flex items-center gap-2">
                <ShieldAlert className="w-4.5 h-4.5 text-nx-gold" />
                Ledger Integrity Auditor
              </h3>
              <p className="text-[11px] text-nx-text-sec leading-relaxed">
                Scan local stream sequences to identify version gaps or state drifts between transaction histories and IndexedDB.
              </p>

              <button
                disabled={isAuditing}
                onClick={handleRunAudit}
                className="w-full py-2.5 px-4 border border-nx-border hover:bg-nx-hover text-nx-text rounded-nx-btn text-[12px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Activity className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
                Run Ledger Consistency Audit
              </button>

              {auditReport && (
                <div className="bg-nx-elevated border border-nx-border rounded p-4 space-y-3 font-data text-[11px] leading-relaxed select-text">
                  <div className="flex items-center gap-1.5 font-bold text-[12px]">
                    {auditReport.passed ? (
                      <span className="text-nx-green flex items-center gap-1"><CheckCircle className="w-4 h-4" /> LEDGER CONSISTENT</span>
                    ) : (
                      <span className="text-nx-red flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> LEDGER INCONSISTENT</span>
                    )}
                  </div>
                  <div>Checked Events: {auditReport.totalEventsChecked}</div>
                  <div>Sequence Gaps: {auditReport.missingEventsCount}</div>
                  <div>State Drifts: {auditReport.driftsCount}</div>
                  {auditReport.details.length > 0 && (
                    <div className="max-h-[100px] overflow-y-auto border-t border-nx-border/50 pt-2 text-[10px] text-nx-text-sec space-y-1">
                      {auditReport.details.map((d, i) => (
                        <div key={i}>{d}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Event Stream Explorer */}
          <div className="border border-nx-border rounded-nx-card p-5 space-y-4">
            <h3 className="font-bold text-[13.5px] text-nx-text">
              Offline Event Buffer Explorer
            </h3>
            
            <div className="overflow-x-auto max-h-[300px] border border-nx-border rounded">
              <table className="w-full text-[11px] text-left border-collapse select-text">
                <thead>
                  <tr className="bg-nx-elevated text-nx-text-sec font-bold border-b border-nx-border">
                    <th className="p-2">Event ID</th>
                    <th className="p-2">Event Type</th>
                    <th className="p-2">Aggregate ID</th>
                    <th className="p-2">Version</th>
                    <th className="p-2">Occurred At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nx-border/50">
                  {queue.map((item) => (
                    <tr key={item.id} className="hover:bg-nx-elevated/40">
                      <td className="p-2 font-data text-nx-text-sec">{item.id.slice(0, 8)}...</td>
                      <td className="p-2 font-semibold text-nx-text">{item.type}</td>
                      <td className="p-2 font-data text-nx-text-sec">{(item.payload as any)?.aggregate_id?.slice(0, 8) || 'N/A'}...</td>
                      <td className="p-2 font-data">{(item.payload as any)?.event_version || 1}</td>
                      <td className="p-2 font-data text-nx-text-sec">{new Date(item.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                  {queue.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-nx-text-muted">
                        Queue is empty. Offline events will appear here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Tab: Security & Trust Mesh */}
      {activeTab === ('security' as any) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[300px]">
          {/* Device Security Credentials Card */}
          <div className="space-y-4">
            <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border pb-2 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-nx-cyan" />
              Cryptographic Device Credentials
            </h3>

            <div className="space-y-3 text-[12px] bg-nx-elevated/40 border border-nx-border p-4 rounded-nx-card select-text">
              <div className="flex flex-col gap-1 border-b border-nx-border/40 pb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-nx-text-sec">Persistent Device UUID</span>
                <span className="font-data font-semibold text-nx-text select-all break-all">{deviceId || 'Generating...'}</span>
              </div>

              <div className="flex flex-col gap-1 border-b border-nx-border/40 pb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-nx-text-sec">Supplemental Hardware Fingerprint</span>
                <span className="font-data font-semibold text-nx-cyan select-all break-all">{fingerprint || 'Computing...'}</span>
              </div>

              <div className="flex justify-between items-center border-b border-nx-border/40 pb-2">
                <span className="text-nx-text-sec">ECDSA Private Key Storage</span>
                <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-nx-green/10 text-nx-green border border-nx-green/20">
                  SECURE & NON-EXPORTABLE
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-nx-border/40 pb-2">
                <span className="text-nx-text-sec">Active Outbound Nonce</span>
                <span className="font-data font-bold text-nx-text">{nonce}</span>
              </div>

              {cert && (
                <>
                  <div className="flex justify-between items-center border-b border-nx-border/40 pb-2">
                    <span className="text-nx-text-sec">Certificate Status</span>
                    <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase ${
                      cert.status === 'active' ? 'bg-nx-green/10 text-nx-green border border-nx-green/20' : 'bg-red-500/10 text-red-600'
                    }`}>
                      {cert.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-nx-border/40 pb-2">
                    <span className="text-nx-text-sec">Certificate Issued At</span>
                    <span className="font-data text-nx-text">{new Date(cert.issuedAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-nx-text-sec">Certificate Expires At</span>
                    <span className="font-data text-nx-text">{new Date(cert.expiresAt).toLocaleDateString()}</span>
                  </div>
                </>
              )}
            </div>

            {/* Rotation Trigger */}
            <div className="bg-nx-elevated/40 border border-nx-border p-4 rounded-nx-card space-y-3">
              <h4 className="font-bold text-[12px] text-nx-text">Cryptographic Rotation & Recovery</h4>
              <p className="text-[10px] text-nx-text-sec leading-relaxed">
                Rotate local P-256 keypairs and generate a new certificate. This will update the trust registry on peer nodes next time replication sync is run.
              </p>
              <button
                onClick={handleKeyRotation}
                disabled={isRotating}
                className="w-full py-2 px-3 bg-nx-cyan hover:bg-nx-cyan/90 text-white font-bold text-[11px] rounded transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
                Rotate Device Credentials
              </button>
              {rotationResult && (
                <div className="text-[10px] font-data p-2 bg-nx-surface border border-nx-border rounded text-nx-text-sec">
                  {rotationResult}
                </div>
              )}
            </div>
          </div>

          {/* Trusted Peer registry */}
          <div className="space-y-4">
            <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border pb-2 flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-nx-gold" />
              Trusted Device Registry (Edge Mesh Nodes)
            </h3>

            <div className="border border-nx-border rounded-nx-card max-h-[400px] overflow-y-auto">
              <table className="w-full text-[11px] text-left border-collapse select-text">
                <thead>
                  <tr className="bg-nx-elevated text-nx-text-sec font-bold border-b border-nx-border">
                    <th className="p-2.5">Device ID</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Last Nonce</th>
                    <th className="p-2.5">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nx-border/50">
                  {peers.map((peer) => (
                    <tr key={peer.deviceId} className="hover:bg-nx-elevated/40">
                      <td className="p-2.5 font-data text-nx-text-sec break-all">{peer.deviceId.slice(0, 12)}...</td>
                      <td className="p-2.5 font-semibold">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          peer.status === 'trusted' ? 'bg-nx-green/10 text-nx-green border border-nx-green/20' :
                          peer.status === 'pending' ? 'bg-nx-gold/10 text-nx-gold border border-nx-gold/20' :
                          'bg-red-500/10 text-red-600 border border-red-200'
                        }`}>
                          {peer.status}
                        </span>
                      </td>
                      <td className="p-2.5 font-data text-nx-text">{peer.lastNonce || 0}</td>
                      <td className="p-2.5 font-data text-nx-text-sec whitespace-nowrap">
                        {peer.lastSeen ? new Date(peer.lastSeen).toLocaleTimeString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                  {peers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-nx-text-muted">
                        No peer devices registered in the local trust registry.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
