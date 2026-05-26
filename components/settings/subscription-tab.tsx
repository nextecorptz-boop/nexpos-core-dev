'use client';

import React from 'react';
import { CreditCard, Activity, Lock, ArrowUpCircle } from 'lucide-react';

interface SubscriptionTabProps {
  planId: 'basic' | 'pro' | 'enterprise';
  branchCount: number;
  staffCount: number;
  terminalCount: number;
  isUpgrading: boolean;
  handleUpgrade: () => void;
  t: (k: string) => string;
}

export default function SubscriptionTab({
  planId,
  branchCount,
  staffCount,
  terminalCount,
  isUpgrading,
  handleUpgrade,
  t
}: SubscriptionTabProps) {
  // Plan Quotas Definition
  const quotas = {
    basic: { branches: 2, staff: 5, terminals: 3 },
    pro: { branches: 10, staff: 25, terminals: 10 },
    enterprise: { branches: Infinity, staff: Infinity, terminals: Infinity }
  };

  const activeQuotas = quotas[planId] || quotas.basic;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[300px]">
      {/* Active Plan details */}
      <div className="space-y-4">
        <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border pb-2 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-nx-cyan" />
          {t('settings.subscription.planCard')}
        </h3>

        <div className="bg-gradient-to-r from-nx-elevated to-nx-elevated/40 border border-nx-border rounded-nx-card p-6 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <CreditCard className="w-24 h-24" />
          </div>

          <div>
            <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase bg-nx-cyan/15 text-nx-cyan border border-nx-cyan/20">
              {planId.toUpperCase()} PLAN
            </span>
            <h4 className="font-bold text-[22px] text-nx-text mt-2 capitalize">{planId} Plan</h4>
            <p className="text-[11px] text-nx-text-sec mt-1">
              {planId === 'basic' ? '$29 / Month billed via PayPal' : planId === 'pro' ? '$99 / Month billed via PayPal' : 'Enterprise Contract'}
            </p>
          </div>

          <div className="border-t border-nx-border/50 pt-4 space-y-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-nx-text-sec">{t('settings.subscription.renewalDate')}</span>
              <span className="font-bold font-data text-nx-text">24/11/2026</span>
            </div>
          </div>

          {planId !== 'enterprise' && (
            <button
              onClick={handleUpgrade}
              disabled={isUpgrading}
              className="w-full py-2.5 px-4 bg-nx-cyan hover:bg-nx-cyan/90 text-white rounded font-bold text-[12px] flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <ArrowUpCircle className="w-4 h-4" />
              {t('settings.subscription.upgradeBtn')}
            </button>
          )}
        </div>

        {/* Locked features indicator if Basic */}
        {planId === 'basic' && (
          <div className="border border-nx-border/80 rounded-nx-card p-4 space-y-3 bg-nx-elevated/30">
            <h4 className="font-bold text-[12px] text-nx-text flex items-center gap-1.5 text-nx-gold">
              <Lock className="w-4 h-4" />
              {t('settings.subscription.lockedFeatures')}
            </h4>
            <p className="text-[10px] text-nx-text-sec leading-relaxed">
              {t('settings.subscription.upgradePrompt')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-nx-text-sec pt-1">
              <div className="flex items-center gap-1.5 opacity-80">
                <span className="w-1.5 h-1.5 bg-nx-border rounded-full" />
                {t('settings.subscription.features.mesh')}
              </div>
              <div className="flex items-center gap-1.5 opacity-80">
                <span className="w-1.5 h-1.5 bg-nx-border rounded-full" />
                {t('settings.subscription.features.locking')}
              </div>
              <div className="flex items-center gap-1.5 opacity-80">
                <span className="w-1.5 h-1.5 bg-nx-border rounded-full" />
                {t('settings.subscription.features.multiBranch')}
              </div>
              <div className="flex items-center gap-1.5 opacity-80">
                <span className="w-1.5 h-1.5 bg-nx-border rounded-full" />
                {t('settings.subscription.features.telemetry')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quotas utilization meters */}
      <div className="space-y-4">
        <h3 className="font-bold text-[13.5px] text-nx-text border-b border-nx-border pb-2 flex items-center gap-2">
          <Activity className="w-4 h-4 text-nx-cyan" />
          {t('settings.subscription.quotaMeters')}
        </h3>

        <div className="space-y-5 bg-nx-elevated/20 border border-nx-border p-5 rounded-nx-card text-[12.5px]">
          {/* Meter 1: Branches */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px] font-bold text-nx-text-sec">
              <span>{t('settings.subscription.branchesQuota')}</span>
              <span>{branchCount} / {isFinite(activeQuotas.branches) ? activeQuotas.branches : t('settings.subscription.unlimited')}</span>
            </div>
            <div className="w-full bg-nx-border/50 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  (branchCount / activeQuotas.branches) >= 0.9 ? 'bg-red-500' : (branchCount / activeQuotas.branches) >= 0.75 ? 'bg-nx-gold' : 'bg-nx-cyan'
                }`}
                style={{ width: `${Math.min((branchCount / (activeQuotas.branches || 1)) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Meter 2: Staff */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px] font-bold text-nx-text-sec">
              <span>{t('settings.subscription.staffQuota')}</span>
              <span>{staffCount} / {isFinite(activeQuotas.staff) ? activeQuotas.staff : t('settings.subscription.unlimited')}</span>
            </div>
            <div className="w-full bg-nx-border/50 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  (staffCount / activeQuotas.staff) >= 0.9 ? 'bg-red-500' : (staffCount / activeQuotas.staff) >= 0.75 ? 'bg-nx-gold' : 'bg-nx-cyan'
                }`}
                style={{ width: `${Math.min((staffCount / (activeQuotas.staff || 1)) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Meter 3: Terminals */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px] font-bold text-nx-text-sec">
              <span>{t('settings.subscription.terminalsQuota')}</span>
              <span>{terminalCount} / {isFinite(activeQuotas.terminals) ? activeQuotas.terminals : t('settings.subscription.unlimited')}</span>
            </div>
            <div className="w-full bg-nx-border/50 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  (terminalCount / activeQuotas.terminals) >= 0.9 ? 'bg-red-500' : (terminalCount / activeQuotas.terminals) >= 0.75 ? 'bg-nx-gold' : 'bg-nx-cyan'
                }`}
                style={{ width: `${Math.min((terminalCount / (activeQuotas.terminals || 1)) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
