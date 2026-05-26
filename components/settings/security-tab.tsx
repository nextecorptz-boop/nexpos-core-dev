'use client';

import React from 'react';
import { Cpu, ShieldAlert, RefreshCw } from 'lucide-react';

interface SecurityTabProps {
  deviceId: string;
  fingerprint: string;
  cert: any;
  nonce: number;
  peers: any[];
  isRotating: boolean;
  rotationMsg: string;
  handleKeyRotation: () => void;
  handleRevokePeer: (peerId: string) => void;
  t: (k: string) => string;
}

export default function SecurityTab({
  deviceId,
  fingerprint,
  cert,
  nonce,
  peers,
  isRotating,
  rotationMsg,
  handleKeyRotation,
  handleRevokePeer,
  t
}: SecurityTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[300px]">
      <div className="space-y-4">
        <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border pb-2 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-nx-cyan" />
          {t('settings.security.credentials')}
        </h3>

        <div className="space-y-3 text-[12px] bg-nx-elevated/40 border border-nx-border p-4 rounded-nx-card select-text">
          <div className="flex flex-col gap-1 border-b border-nx-border/40 pb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-nx-text-sec">{t('settings.security.deviceUuid')}</span>
            <span className="font-data font-semibold text-nx-text select-all break-all">{deviceId}</span>
          </div>

          <div className="flex flex-col gap-1 border-b border-nx-border/40 pb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-nx-text-sec">{t('settings.security.fingerprint')}</span>
            <span className="font-data font-semibold text-nx-cyan select-all break-all">{fingerprint}</span>
          </div>

          <div className="flex justify-between items-center border-b border-nx-border/40 pb-2">
            <span className="text-nx-text-sec">{t('settings.security.keyStorage')}</span>
            <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold bg-nx-green/10 text-nx-green border border-nx-green/20">
              {t('settings.security.keyStorageStatus')}
            </span>
          </div>

          <div className="flex justify-between items-center border-b border-nx-border/40 pb-2">
            <span className="text-nx-text-sec">{t('settings.security.activeNonce')}</span>
            <span className="font-data font-bold text-nx-text">{nonce}</span>
          </div>

          {cert && (
            <>
              <div className="flex justify-between items-center border-b border-nx-border/40 pb-2">
                <span className="text-nx-text-sec">{t('settings.security.certStatus')}</span>
                <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase ${
                  cert.status === 'active' ? 'bg-nx-green/10 text-nx-green border border-nx-green/20' : 'bg-red-500/10 text-red-600 border border-red-200'
                }`}>
                  {cert.status}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-nx-border/40 pb-2">
                <span className="text-nx-text-sec">{t('settings.security.certIssued')}</span>
                <span className="font-data text-nx-text">{new Date(cert.issuedAt).toLocaleDateString()}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-nx-text-sec">{t('settings.security.certExpires')}</span>
                <span className="font-data text-nx-text">{new Date(cert.expiresAt).toLocaleDateString()}</span>
              </div>
            </>
          )}
        </div>

        {/* Rotation Panel */}
        <div className="bg-nx-elevated/40 border border-nx-border p-4 rounded-nx-card space-y-3">
          <h4 className="font-bold text-[12px] text-nx-text">{t('settings.security.rotationTitle')}</h4>
          <p className="text-[10px] text-nx-text-sec leading-relaxed">
            {t('settings.security.rotationDesc')}
          </p>
          <button
            onClick={handleKeyRotation}
            disabled={isRotating}
            className="w-full py-2 px-3 bg-nx-cyan hover:bg-nx-cyan/90 text-white font-bold text-[11px] rounded transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
            {t('settings.security.rotateBtn')}
          </button>
          {rotationMsg && (
            <div className="text-[10px] font-data p-2 bg-nx-surface border border-nx-border rounded text-nx-text-sec">
              {rotationMsg}
            </div>
          )}
        </div>
      </div>

      {/* Trusted Peer registry */}
      <div className="space-y-4">
        <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border pb-2 flex items-center gap-2">
          <ShieldAlert className="w-4.5 h-4.5 text-nx-gold" />
          {t('settings.security.trustRegistry')}
        </h3>

        <div className="border border-nx-border rounded-nx-card max-h-[400px] overflow-y-auto">
          <table className="w-full text-[11px] text-left border-collapse select-text">
            <thead>
              <tr className="bg-nx-elevated text-nx-text-sec font-bold border-b border-nx-border">
                <th className="p-2.5">{t('settings.security.peerDeviceId')}</th>
                <th className="p-2.5">{t('settings.security.peerStatus')}</th>
                <th className="p-2.5">{t('settings.security.peerNonce')}</th>
                <th className="p-2.5">{t('settings.security.peerLastSeen')}</th>
                <th className="p-2.5 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nx-border/50">
              {peers.map((peer) => (
                <tr key={peer.deviceId} className="hover:bg-nx-elevated/40">
                  <td className="p-2.5 font-data text-nx-text-sec break-all">{peer.deviceId.slice(0, 10)}...</td>
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
                  <td className="p-2.5 text-right">
                    {peer.status !== 'revoked' && (
                      <button
                        onClick={() => handleRevokePeer(peer.deviceId)}
                        className="text-red-500 hover:text-red-400 font-bold text-[10px]"
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {peers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-nx-text-muted">
                    {t('settings.security.noPeers')}
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
