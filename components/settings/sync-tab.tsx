'use client';

import React from 'react';
import { Layers, CheckCircle, Activity } from 'lucide-react';

interface SyncTabProps {
  isLeader: boolean;
  peers: any[];
  wanQuality: 'excellent' | 'fair' | 'poor';
  pendingQueueCount: number;
  failoverLogs: any[];
  t: (k: string) => string;
}

export default function SyncTab({
  isLeader,
  peers,
  wanQuality,
  pendingQueueCount,
  failoverLogs,
  t
}: SyncTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[300px]">
      {/* Edge leadership information */}
      <div className="space-y-4">
        <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border pb-2 flex items-center gap-2">
          <Layers className="w-4.5 h-4.5 text-nx-cyan" />
          {t('settings.sync.leaderCard')}
        </h3>

        <div className="space-y-3 bg-nx-elevated/40 border border-nx-border p-4 rounded-nx-card text-[12.5px]">
          <div className="flex justify-between items-center border-b border-nx-border/40 pb-2">
            <span className="text-nx-text-sec">{t('settings.sync.leaderStatus')}</span>
            <span className={`px-2.5 py-0.5 rounded text-[10.5px] font-bold ${
              isLeader ? 'bg-nx-green/10 text-nx-green border border-nx-green/20' : 'bg-nx-cyan/15 text-nx-cyan border border-nx-cyan/20'
            }`}>
              {isLeader ? t('settings.sync.leader') : t('settings.sync.follower')}
            </span>
          </div>

          <div className="flex justify-between items-center border-b border-nx-border/40 pb-2">
            <span className="text-nx-text-sec">{t('settings.sync.peerCount')}</span>
            <span className="font-data font-bold text-nx-text">{peers.filter(p => p.status === 'trusted').length} nodes</span>
          </div>

          <div className="flex justify-between items-center border-b border-nx-border/40 pb-2">
            <span className="text-nx-text-sec">{t('settings.sync.meshHealth')}</span>
            <span className="font-semibold text-nx-green flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> STABLE (RAFT-OK)
            </span>
          </div>

          <div className="flex justify-between items-center border-b border-nx-border/40 pb-2">
            <span className="text-nx-text-sec">{t('settings.sync.wanQuality')}</span>
            <span className={`font-semibold capitalize ${wanQuality === 'excellent' ? 'text-nx-green' : 'text-red-500'}`}>
              {wanQuality === 'excellent' ? t('settings.sync.online') : t('settings.sync.offline')}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-nx-text-sec">{t('settings.sync.pendingQueue')}</span>
            <span className="font-data font-bold text-nx-text">{pendingQueueCount} items</span>
          </div>
        </div>

        {/* Smart queue priorities info */}
        <div className="border border-nx-border/80 rounded-nx-card p-4 space-y-2 bg-nx-elevated/20">
          <h4 className="font-bold text-[12px] text-nx-text">{t('settings.sync.queuePriority')}</h4>
          <p className="text-[10px] text-nx-text-sec leading-relaxed">
            {t('settings.sync.queueDesc')}
          </p>
        </div>
      </div>

      {/* Failover Telemetry logs */}
      <div className="space-y-4">
        <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border pb-2 flex items-center gap-2">
          <Activity className="w-4.5 h-4.5 text-nx-gold" />
          {t('settings.sync.failoverLogs')}
        </h3>

        <div className="border border-nx-border rounded-nx-card max-h-[350px] overflow-y-auto">
          <table className="w-full text-[11px] text-left border-collapse select-text">
            <thead>
              <tr className="bg-nx-elevated text-nx-text-sec font-bold border-b border-nx-border">
                <th className="p-2">{t('settings.security.peerLastSeen')}</th>
                <th className="p-2">{t('settings.sync.logMessage')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-border/50 leading-relaxed">
              {failoverLogs.map((log) => (
                <tr key={log.id} className="hover:bg-nx-elevated/40">
                  <td className="p-2 font-data text-nx-text-sec whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-2 font-medium text-nx-text select-all">
                    {log.message}
                  </td>
                </tr>
              ))}
              {failoverLogs.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-nx-text-muted">
                    {t('settings.sync.noLogs')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
