'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { db } from '@/lib/sync/db';
import { useTranslations } from '@/hooks/use-translations';
import { Telemetry } from '@/lib/telemetry/telemetry';
import { Settings, RefreshCw } from 'lucide-react';

// Dynamically import heavy operational panels with SSR disabled
const GeneralTab = dynamic(() => import('@/components/settings/general-tab'), { ssr: false });
const SecurityTab = dynamic(() => import('@/components/settings/security-tab'), { ssr: false });
const SubscriptionTab = dynamic(() => import('@/components/settings/subscription-tab'), { ssr: false });
const SyncTab = dynamic(() => import('@/components/settings/sync-tab'), { ssr: false });
const StaffTab = dynamic(() => import('@/components/settings/staff-tab'), { ssr: false });

export default function SettingsPage() {
  const { t, language, setLanguage } = useTranslations();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'subscription' | 'sync' | 'staff'>('general');
  
  // Common state
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // General Settings state
  const [branchName, setBranchName] = useState('');
  const [timezone, setTimezone] = useState('Africa/Dar_es_Salaam');
  const [currency, setCurrency] = useState('TZS');
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');

  // Security Settings state
  const [deviceId, setDeviceId] = useState('');
  const [fingerprint, setFingerprint] = useState('');
  const [cert, setCert] = useState<any>(null);
  const [nonce, setNonce] = useState<number>(0);
  const [peers, setPeers] = useState<any[]>([]);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationMsg, setRotationMsg] = useState('');

  // Subscription Settings state
  const [planId, setPlanId] = useState<'basic' | 'pro' | 'enterprise'>('basic');
  const [branchCount, setBranchCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);
  const [terminalCount, setTerminalCount] = useState(0);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Sync & Edge state
  const [isLeader, setIsLeader] = useState(false);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [failoverLogs, setFailoverLogs] = useState<any[]>([]);
  const [wanQuality, setWanQuality] = useState<'excellent' | 'fair' | 'poor'>('excellent');

  // Staff state
  const [staffList, setStaffList] = useState<any[]>([]);

  // Load configuration details
  const loadConfiguration = async () => {
    try {
      setLoading(true);
      
      // 1. Resolve local keys & cert
      const { getOrCreateDeviceKeys } = await import('@/lib/security/device-crypto');
      const { getLocalCertificate } = await import('@/lib/security/device-certificates');
      const { getDeviceFingerprint } = await import('@/lib/security/device-identity');
      const { listTrustRegistry } = await import('@/lib/security/device-registry');

      const keys = await getOrCreateDeviceKeys();
      setDeviceId(keys.deviceId);

      const fp = await getDeviceFingerprint();
      setFingerprint(fp);

      const localCert = await getLocalCertificate(keys.deviceId);
      setCert(localCert);

      const nonceRec = await db.settings.get('device_signature_nonce');
      setNonce(nonceRec ? Number(nonceRec.value) : 0);

      // Load registry peers
      const registryPeers = await listTrustRegistry();
      setPeers(registryPeers);

      // 2. Load General Settings
      const branchNameSetting = await db.settings.get('branch_name') || { value: 'Dar es Salaam Central' };
      const tzSetting = await db.settings.get('system_timezone') || { value: 'Africa/Dar_es_Salaam' };
      const currencySetting = await db.settings.get('system_currency') || { value: 'TZS' };
      const receiptHeaderSetting = await db.settings.get('receipt_header') || { value: 'NEXPOS Tanzania Ltd' };
      const receiptFooterSetting = await db.settings.get('receipt_footer') || { value: 'Asante kwa kufanya biashara nasi!' };

      setBranchName(branchNameSetting.value);
      setTimezone(tzSetting.value);
      setCurrency(currencySetting.value);
      setReceiptHeader(receiptHeaderSetting.value);
      setReceiptFooter(receiptFooterSetting.value);

      // 3. Load counts for Quotas & Usages (Basic Plan simulation values as baseline)
      const cachedPlan = await db.settings.get('subscription_plan') || { value: 'basic' };
      setPlanId(cachedPlan.value);
      
      // Count local branches
      const localBranches = [
        { id: '1', name: 'Dar es Salaam Central', active: true },
        { id: '2', name: 'Kariakoo Outlet', active: true }
      ];
      setBranchCount(localBranches.length);

      // Load mock staff list representing current local branch profiles
      const mockStaff = [
        { id: 'usr-1', name: 'Amani John', email: 'amani@nexpos.co.tz', role: 'manager', branch: 'Dar es Salaam Central', active: true },
        { id: 'usr-2', name: 'Neema Mwangi', email: 'neema@nexpos.co.tz', role: 'cashier', branch: 'Dar es Salaam Central', active: true },
        { id: 'usr-3', name: 'Faraji Bakari', email: 'faraji@nexpos.co.tz', role: 'cashier', branch: 'Kariakoo Outlet', active: false }
      ];
      setStaffList(mockStaff);
      setStaffCount(mockStaff.filter(s => s.active).length);

      // Terminals quota is peer count + 1 (local device)
      setTerminalCount(registryPeers.length + 1);

      // 4. Sync State
      const leaderSetting = await db.settings.get('mesh_is_leader') || { value: false };
      setIsLeader(leaderSetting.value);

      const q1 = await db.queue_tier_1.count();
      const q2 = await db.queue_tier_2.count();
      const q3 = await db.queue_tier_3.count();
      setPendingQueueCount(q1 + q2 + q3);

      // Load failover logs from telemetry
      const logs = await db.telemetry_logs
        .filter(l => l.category === 'sync' && (l.message.includes('Leader') || l.message.includes('Failover') || l.message.includes('SPLIT-BRAIN')))
        .reverse()
        .limit(10)
        .toArray();
      setFailoverLogs(logs);

      // Mock WAN quality status based on battery/connection states
      if (typeof navigator !== 'undefined') {
        setWanQuality(navigator.onLine ? 'excellent' : 'poor');
      }

    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfiguration();
  }, []);

  // Save General settings
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSuccessMsg('');
    try {
      await db.settings.put({ key: 'branch_name', value: branchName });
      await db.settings.put({ key: 'system_timezone', value: timezone });
      await db.settings.put({ key: 'system_currency', value: currency });
      await db.settings.put({ key: 'receipt_header', value: receiptHeader });
      await db.settings.put({ key: 'receipt_footer', value: receiptFooter });
      
      setSuccessMsg(t('settings.general.saveSuccess'));
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  // Toggle display language
  const handleLanguageToggle = async (newLang: 'en' | 'sw') => {
    if (newLang === language) return;
    const prevLang = language;
    
    // Trigger Context language switch
    setLanguage(newLang);
    
    // Save to settings
    await db.settings.put({ key: 'client_language', value: newLang });

    // Telemetry log
    await Telemetry.trackLanguageChange(deviceId, prevLang, newLang);
  };

  // Execute manual key rotation
  const handleKeyRotation = async () => {
    setIsRotating(true);
    setRotationMsg('');
    try {
      const { rotateDeviceKeys } = await import('@/lib/security/key-rotation');
      const newCert = await rotateDeviceKeys('tenant-security-chaos');
      setRotationMsg(`${t('settings.security.rotationSuccess')} Expires: ${new Date(newCert.expiresAt).toLocaleDateString()}`);
      
      // Update telemetry
      await Telemetry.trackKeyRotation(deviceId, true);
      
      await loadConfiguration();
    } catch (err: any) {
      console.error('Key rotation failed:', err);
      setRotationMsg(`Rotation failed: ${err.message || err}`);
      await Telemetry.trackKeyRotation(deviceId, false, { error: err.message || err });
    } finally {
      setIsRotating(false);
    }
  };

  // Administrative peer revocation control
  const handleRevokePeer = async (peerId: string) => {
    if (!window.confirm('Are you sure you want to revoke this peer device?')) return;
    try {
      const { revokeDevice } = await import('@/lib/security/revocation-manager');
      await revokeDevice(peerId, 'Administrative setting trigger');
      await loadConfiguration();
    } catch (err) {
      console.error('Revocation failed:', err);
    }
  };

  // Handle plan upgrade trigger
  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      // Simulate upgrading basic -> pro
      const nextPlan = planId === 'basic' ? 'pro' : 'enterprise';
      await db.settings.put({ key: 'subscription_plan', value: nextPlan });
      setPlanId(nextPlan);
      await Telemetry.info('sync', `Tenant subscription upgraded to ${nextPlan.toUpperCase()}.`);
      alert(`Subscription successfully upgraded to ${nextPlan.toUpperCase()} plan!`);
      await loadConfiguration();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-nx-text">
        <RefreshCw className="w-8 h-8 animate-spin text-nx-cyan mb-4" />
        <p className="text-sm font-semibold">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="bg-nx-surface border border-nx-border rounded-nx-card p-6 flex flex-col gap-6 select-none shadow-sm text-nx-text">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-nx-border pb-4">
        <div>
          <h1 className="text-[20px] font-bold text-nx-text flex items-center gap-2">
            <Settings className="w-6 h-6 text-nx-cyan" />
            {t('settings.title')}
          </h1>
          <p className="text-[11.5px] text-nx-text-sec mt-1 max-w-3xl">
            {t('settings.subtitle')}
          </p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex flex-wrap gap-2 border-b border-nx-border pb-1">
        {(['general', 'security', 'subscription', 'sync', 'staff'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2.5 px-4 font-semibold text-[12px] border-b-2 transition-all ${
              activeTab === tab ? 'border-nx-cyan text-nx-text' : 'border-transparent text-nx-text-sec hover:text-nx-text'
            }`}
          >
            {t(`settings.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Tab Render Panel */}
      <div className="w-full">
        {activeTab === 'general' && (
          <GeneralTab
            branchName={branchName}
            setBranchName={setBranchName}
            timezone={timezone}
            setTimezone={setTimezone}
            currency={currency}
            language={language}
            handleLanguageToggle={handleLanguageToggle}
            receiptHeader={receiptHeader}
            setReceiptHeader={setReceiptHeader}
            receiptFooter={receiptFooter}
            setReceiptFooter={setReceiptFooter}
            saveLoading={saveLoading}
            successMsg={successMsg}
            handleSaveGeneral={handleSaveGeneral}
            t={t}
          />
        )}

        {activeTab === 'security' && (
          <SecurityTab
            deviceId={deviceId}
            fingerprint={fingerprint}
            cert={cert}
            nonce={nonce}
            peers={peers}
            isRotating={isRotating}
            rotationMsg={rotationMsg}
            handleKeyRotation={handleKeyRotation}
            handleRevokePeer={handleRevokePeer}
            t={t}
          />
        )}

        {activeTab === 'subscription' && (
          <SubscriptionTab
            planId={planId}
            branchCount={branchCount}
            staffCount={staffCount}
            terminalCount={terminalCount}
            isUpgrading={isUpgrading}
            handleUpgrade={handleUpgrade}
            t={t}
          />
        )}

        {activeTab === 'sync' && (
          <SyncTab
            isLeader={isLeader}
            peers={peers}
            wanQuality={wanQuality}
            pendingQueueCount={pendingQueueCount}
            failoverLogs={failoverLogs}
            t={t}
          />
        )}

        {activeTab === 'staff' && (
          <StaffTab
            staffList={staffList}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
