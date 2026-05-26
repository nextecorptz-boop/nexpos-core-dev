import Dexie, { type Table } from 'dexie';

export interface LocalVariant {
  id: string;
  tenant_id: string;
  branch_id?: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  cost_price: number;
  quantity: number;
  updated_at: string;
  [key: string]: any;
}

export interface LocalCustomer {
  id: string;
  tenant_id: string;
  name: string;
  phone?: string;
  email?: string;
  updated_at: string;
  [key: string]: any;
}

export interface LocalSupplier {
  id: string;
  tenant_id: string;
  name: string;
  phone?: string;
  updated_at: string;
  [key: string]: any;
}

export interface LocalTransfer {
  id: string;
  tenant_id: string;
  from_branch_id: string;
  to_branch_id: string;
  status: 'draft' | 'dispatched' | 'received' | 'cancelled';
  items: any[];
  updated_at: string;
  [key: string]: any;
}

export interface LocalReservation {
  id: string;
  tenant_id: string;
  branch_id: string;
  variant_id: string;
  quantity: number;
  reference_id?: string;
  reference_type?: string;
  created_at: string;
}

export interface QueueItem<T = any> {
  id: string; // client-generated unique UUID
  type: string;
  payload: T;
  status: 'pending' | 'failed';
  error?: string;
  timestamp: string;
  retryCount: number;
  device_id: string;
  tenant_id: string;
}

export interface QuarantinedMutation {
  id: string;
  type: string;
  payload: any;
  error: string;
  timestamp: string;
  device_id: string;
  tenant_id: string;
}

export interface Setting {
  key: string;
  value: any;
}

export interface TelemetryLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  category: 'sync' | 'db' | 'network' | 'performance' | 'security';
  message: string;
  details?: any;
}

export interface DeviceCertificate {
  deviceId: string;
  tenantId: string;
  publicKeyJwk: JsonWebKey;
  issuedAt: string;
  expiresAt: string;
  status: 'active' | 'rotated' | 'revoked' | 'expired';
  signature: string;
}

export interface TrustRegistryEntry {
  deviceId: string;
  tenantId: string;
  publicKeyJwk: JsonWebKey;
  status: 'trusted' | 'pending' | 'rotated' | 'expired' | 'revoked' | 'quarantined' | 'suspected';
  lastSeen?: string;
  lastNonce?: number;
}

class NexposDatabase extends Dexie {
  queue_tier_0!: Table<QueueItem, string>;
  queue_tier_1!: Table<QueueItem, string>;
  queue_tier_2!: Table<QueueItem, string>;
  queue_tier_3!: Table<QueueItem, string>;
  variants!: Table<LocalVariant, string>;
  customers!: Table<LocalCustomer, string>;
  suppliers!: Table<LocalSupplier, string>;
  transfers!: Table<LocalTransfer, string>;
  reservations!: Table<LocalReservation, string>;
  settings!: Table<Setting, string>;
  quarantined_mutations!: Table<QuarantinedMutation, string>;
  telemetry_logs!: Table<TelemetryLog, string>;
  device_certificates!: Table<DeviceCertificate, string>;
  device_trust_registry!: Table<TrustRegistryEntry, string>;

  constructor() {
    super('nexpos_db');
    this.version(1).stores({
      queue_tier_1: 'id, type, status, timestamp, tenant_id',
      queue_tier_2: 'id, type, status, timestamp, tenant_id',
      queue_tier_3: 'id, type, status, timestamp, tenant_id',
      variants: 'id, branch_id, tenant_id, updated_at, sku, barcode',
      customers: 'id, tenant_id, updated_at',
      suppliers: 'id, tenant_id, updated_at',
      transfers: 'id, from_branch_id, to_branch_id, tenant_id, status, updated_at',
      reservations: 'id, branch_id, tenant_id, variant_id, reference_id',
      settings: 'key',
      quarantined_mutations: 'id, type, timestamp, error, tenant_id'
    });
    this.version(2).stores({
      queue_tier_1: 'id, type, status, timestamp, tenant_id',
      queue_tier_2: 'id, type, status, timestamp, tenant_id',
      queue_tier_3: 'id, type, status, timestamp, tenant_id',
      variants: 'id, branch_id, tenant_id, updated_at, sku, barcode',
      customers: 'id, tenant_id, updated_at',
      suppliers: 'id, tenant_id, updated_at',
      transfers: 'id, from_branch_id, to_branch_id, tenant_id, status, updated_at',
      reservations: 'id, branch_id, tenant_id, variant_id, reference_id',
      settings: 'key',
      quarantined_mutations: 'id, type, timestamp, error, tenant_id',
      telemetry_logs: 'id, timestamp, level, category'
    });
    this.version(3).stores({
      queue_tier_1: 'id, type, status, timestamp, tenant_id',
      queue_tier_2: 'id, type, status, timestamp, tenant_id',
      queue_tier_3: 'id, type, status, timestamp, tenant_id',
      variants: 'id, branch_id, tenant_id, updated_at, sku, barcode',
      customers: 'id, tenant_id, updated_at',
      suppliers: 'id, tenant_id, updated_at',
      transfers: 'id, from_branch_id, to_branch_id, tenant_id, status, updated_at',
      reservations: 'id, branch_id, tenant_id, variant_id, reference_id',
      settings: 'key',
      quarantined_mutations: 'id, type, timestamp, error, tenant_id',
      telemetry_logs: 'id, timestamp, level, category',
      device_certificates: 'deviceId, tenantId, status, expiresAt',
      device_trust_registry: 'deviceId, tenantId, status'
    });
    this.version(4).stores({
      queue_tier_0: 'id, type, status, timestamp, tenant_id',
      queue_tier_1: 'id, type, status, timestamp, tenant_id',
      queue_tier_2: 'id, type, status, timestamp, tenant_id',
      queue_tier_3: 'id, type, status, timestamp, tenant_id',
      variants: 'id, branch_id, tenant_id, updated_at, sku, barcode',
      customers: 'id, tenant_id, updated_at',
      suppliers: 'id, tenant_id, updated_at',
      transfers: 'id, from_branch_id, to_branch_id, tenant_id, status, updated_at',
      reservations: 'id, branch_id, tenant_id, variant_id, reference_id',
      settings: 'key',
      quarantined_mutations: 'id, type, timestamp, error, tenant_id',
      telemetry_logs: 'id, timestamp, level, category',
      device_certificates: 'deviceId, tenantId, status, expiresAt',
      device_trust_registry: 'deviceId, tenantId, status'
    });
  }
}

import { assertClient } from '@/lib/client-only';

let _db: NexposDatabase | null = null;

export function getDb(): NexposDatabase {
  if (typeof window === 'undefined') {
    // Return a dummy proxy to prevent crash during import/pre-rendering on server side
    return new Proxy({} as any, {
      get(target, prop) {
        if (prop === 'isOpen') return () => false;
        if (prop === 'open') return async () => {};
        return new Proxy({} as any, {
          get(t, p) {
            throw new Error(`IndexedDB / Dexie is not available on the server. Attempted to access table property "${String(prop)}.${String(p)}".`);
          }
        });
      }
    });
  }

  assertClient('db');

  if (!_db) {
    _db = new NexposDatabase();
    _db.open().catch((error) => {
      console.error('Dexie database failed to open or encountered corruption:', error);
      if (
        error.name === 'DatabaseClosedError' ||
        error.name === 'VersionError' ||
        error.name === 'UpgradeError' ||
        error.message?.toLowerCase().includes('corrupt')
      ) {
        console.warn('Unrecoverable database error. Resetting local IndexedDB store...');
        Dexie.delete('nexpos_db').then(() => {
          window.location.reload();
        }).catch((deleteErr) => {
          console.error('Failed to reset database store:', deleteErr);
        });
      }
    });
  }
  return _db;
}

export const db = new Proxy({} as NexposDatabase, {
  get(target, prop) {
    const activeDb = getDb();
    const value = (activeDb as any)[prop];
    if (typeof value === 'function') {
      return value.bind(activeDb);
    }
    return value;
  },
  set(target, prop, value) {
    const activeDb = getDb();
    (activeDb as any)[prop] = value;
    return true;
  }
});

export async function migrateLegacyOfflineStorage() {
  if (typeof window === 'undefined' || !window.indexedDB || !window.indexedDB.databases) return;

  try {
    const dbs = await window.indexedDB.databases();
    const hasLegacy = dbs.some(d => d.name === 'essyshoe-db');
    if (!hasLegacy) return;

    const legacyDb = new Dexie('essyshoe-db');
    legacyDb.version(1).stores({
      queue_tier_1: 'id, type, status, timestamp, tenant_id',
      queue_tier_2: 'id, type, status, timestamp, tenant_id',
      queue_tier_3: 'id, type, status, timestamp, tenant_id',
      variants: 'id, branch_id, tenant_id, updated_at, sku, barcode',
      customers: 'id, tenant_id, updated_at',
      suppliers: 'id, tenant_id, updated_at',
      transfers: 'id, from_branch_id, to_branch_id, tenant_id, status, updated_at',
      reservations: 'id, branch_id, tenant_id, variant_id, reference_id',
      settings: 'key',
      quarantined_mutations: 'id, type, timestamp, error, tenant_id'
    });

    await legacyDb.open();
    
    const isNewDbEmpty = await db.queue_tier_1.count() === 0 && await db.variants.count() === 0;
    
    if (isNewDbEmpty) {
      console.log('Migrating legacy offline storage (essyshoe-db -> nexpos_db)...');
      for (const table of legacyDb.tables) {
        if (db[table.name as keyof NexposDatabase]) {
          const records = await table.toArray();
          if (records.length > 0) {
            const nexposTable = db[table.name as keyof NexposDatabase] as Table<any, any>;
            await nexposTable.bulkAdd(records).catch(e => console.warn(`Migration skip (already exists) for ${table.name}`, e));
          }
        }
      }
      console.log('Legacy offline storage migration complete.');
    }
    
    await legacyDb.close();
  } catch (err) {
    console.error('Failed to migrate legacy database:', err);
  }
}
