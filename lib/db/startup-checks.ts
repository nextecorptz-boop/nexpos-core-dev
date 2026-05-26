import { db } from '@/lib/sync/db';
import { Telemetry } from '@/lib/telemetry/telemetry';

export interface IntegrityResult {
  healthy: boolean;
  isolated: boolean;
  status: string;
  diagnostics: {
    memoryGb: number | string;
    storageUsageMb: number;
    storageQuotaMb: number;
    dbOpen: boolean;
    syncAgeDays: number;
    clientStatus: string;
  };
}

export async function runStartupIntegrityChecks(): Promise<IntegrityResult> {
  const result: IntegrityResult = {
    healthy: true,
    isolated: false,
    status: 'SYSTEM_OK',
    diagnostics: {
      memoryGb: 'unknown',
      storageUsageMb: 0,
      storageQuotaMb: 0,
      dbOpen: false,
      syncAgeDays: 0,
      clientStatus: 'active'
    }
  };

  // 1. Hardware/Memory diagnostics check (critical for low-end tablets)
  if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
    const memory = (navigator as any).deviceMemory;
    result.diagnostics.memoryGb = memory;
    if (memory < 2) {
      await Telemetry.warn('performance', `Low-spec device detected. Available RAM is approximately ${memory}GB. Throttling caching strategies.`);
    }
  }

  // 2. Storage capacity quota diagnostics check
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usageMb = Math.round((estimate.usage || 0) / (1024 * 1024));
      const quotaMb = Math.round((estimate.quota || 0) / (1024 * 1024));
      result.diagnostics.storageUsageMb = usageMb;
      result.diagnostics.storageQuotaMb = quotaMb;

      if (quotaMb > 0 && (usageMb / quotaMb) > 0.85) {
        result.healthy = false;
        result.status = 'LOW_STORAGE_ALERT';
        await Telemetry.error('db', `Storage capacity warning. Using ${usageMb}MB of ${quotaMb}MB (${((usageMb/quotaMb)*100).toFixed(1)}%). Sync database may fail.`);
      }
    } catch (e) {
      console.warn('Storage estimate check failed:', e);
    }
  }

  // 3. IndexedDB Open & Schema Check
  try {
    if (!db.isOpen()) {
      await db.open();
    }
    result.diagnostics.dbOpen = true;
  } catch (err: any) {
    result.healthy = false;
    result.status = 'DATABASE_CORRUPT';
    await Telemetry.trackDbCorruption(err);
    
    // Auto-trigger recovery handler if corrupt
    if (
      err.name === 'DatabaseClosedError' ||
      err.name === 'VersionError' ||
      err.name === 'UpgradeError' ||
      err.message?.toLowerCase().includes('corrupt')
    ) {
      result.status = 'DATABASE_RECOVERY_TRIGGERED';
      await Telemetry.critical('db', 'Triggering automatic IndexedDB delete and page reload for recovery.');
    }
    return result;
  }

  // 4. Stale Client Status Retrieval
  try {
    const statusSetting = await db.settings.get('client_status');
    const status = statusSetting ? String(statusSetting.value) : 'active';
    result.diagnostics.clientStatus = status;

    if (status.startsWith('isolated')) {
      result.healthy = false;
      result.isolated = true;
      result.status = status === 'isolated_stale' ? 'CLIENT_ISOLATED_STALE' : 'CLIENT_ISOLATED_INCOMPATIBLE';
    }

    const lastSyncSetting = await db.settings.get('last_successful_sync');
    if (lastSyncSetting && lastSyncSetting.value) {
      const lastSyncDate = new Date(lastSyncSetting.value);
      const diffDays = (Date.now() - lastSyncDate.getTime()) / (1000 * 3600 * 24);
      result.diagnostics.syncAgeDays = Math.round(diffDays);
    }
  } catch (e) {
    console.error('Failed checking local settings during startup:', e);
  }

  return result;
}
