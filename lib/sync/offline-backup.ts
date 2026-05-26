/**
 * Offline Backup System
 * Exports critical IndexedDB tables to encrypted local files for emergency recovery.
 */

import { db } from './db';
import { getOrCreateDeviceId } from './device';

class OfflineBackupManager {
  private readonly BACKUP_FILENAME = 'nexpos_emergency_backup.json';

  /**
   * Performs a full encrypted backup of critical local state
   */
  async performBackup(pin: string) {
    try {
      console.log('Starting scheduled offline backup...');
      
      const tablesToBackup = [
        'queue_tier_0', 'queue_tier_1', 'queue_tier_2', 'queue_tier_3',
        'variants', 'customers', 'suppliers', 'settings'
      ];

      const backupData: Record<string, any[]> = {};
      for (const tableName of tablesToBackup) {
        const table = (db as any)[tableName];
        if (table) {
          backupData[tableName] = await table.toArray();
        }
      }

      const jsonData = JSON.stringify({
        deviceId: await getOrCreateDeviceId(),
        timestamp: new Date().toISOString(),
        data: backupData
      });

      const encrypted = await this.encrypt(jsonData, pin);
      
      // In a real browser/PWA, we would use the File System Access API or download as blob
      // For this implementation, we'll store it in a dedicated Dexie table or LocalStorage
      // to simulate "local file" persistence that survives IndexedDB wipes.
      localStorage.setItem(this.BACKUP_FILENAME, JSON.stringify(encrypted));
      
      console.log('Encrypted offline backup completed successfully.');
      return true;
    } catch (err) {
      console.error('Offline backup failed:', err);
      return false;
    }
  }

  private async deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const deviceId = await getOrCreateDeviceId();
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(pin + deviceId),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private async encrypt(data: string, pin: string) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(pin, salt);

    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(data)
    );

    return {
      content: btoa(String.fromCharCode(...new Uint8Array(encryptedContent))),
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv))
    };
  }

  async restoreBackup(pin: string) {
    const stored = localStorage.getItem(this.BACKUP_FILENAME);
    if (!stored) throw new Error('No backup found');

    const { content, salt, iv } = JSON.parse(stored);
    const key = await this.deriveKey(pin, new Uint8Array(atob(salt).split('').map(c => c.charCodeAt(0))));
    const decryptedContent = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0))) },
      key,
      new Uint8Array(atob(content).split('').map(c => c.charCodeAt(0)))
    );

    const decoded = new TextDecoder().decode(decryptedContent);
    const backup = JSON.parse(decoded);

    // Restore to IndexedDB
    for (const [tableName, records] of Object.entries(backup.data)) {
      const table = (db as any)[tableName];
      if (table) {
        await table.clear();
        await table.bulkAdd(records);
      }
    }

    console.log('Restored state from encrypted backup successfully.');
    return true;
  }
}

import { assertClient } from '@/lib/client-only';

let _offlineBackupManager: OfflineBackupManager | null = null;

export function getOfflineBackupManager(): OfflineBackupManager {
  if (typeof window === 'undefined') {
    // Return a dummy proxy to prevent crash during import/pre-rendering on server side
    return new Proxy({} as any, {
      get(target, prop) {
        throw new Error(`OfflineBackupManager is not available on the server. Attempted to access property "${String(prop)}".`);
      }
    });
  }

  assertClient('offlineBackupManager');

  if (!_offlineBackupManager) {
    _offlineBackupManager = new OfflineBackupManager();
  }
  return _offlineBackupManager;
}

export const offlineBackupManager = new Proxy({} as OfflineBackupManager, {
  get(target, prop) {
    const activeBackupManager = getOfflineBackupManager();
    const value = (activeBackupManager as any)[prop];
    if (typeof value === 'function') {
      return value.bind(activeBackupManager);
    }
    return value;
  }
});
