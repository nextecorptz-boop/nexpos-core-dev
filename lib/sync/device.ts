import { db } from './db';

const COOKIE_NAME = 'nx_device_id';

export async function getOrCreateDeviceId(): Promise<string> {
  if (typeof window === 'undefined') return 'server-side';

  // 1. Try to read from Dexie settings
  try {
    const cached = await db.settings.get('device_id');
    if (cached && typeof cached.value === 'string') {
      ensureCookie(cached.value);
      return cached.value;
    }
  } catch (e) {
    console.error('Dexie error reading device_id', e);
  }

  // 2. Try to read from Cookie
  const cookieValue = getCookie(COOKIE_NAME);
  if (cookieValue) {
    // Mirror back to Dexie
    try {
      await db.settings.put({ key: 'device_id', value: cookieValue });
    } catch (e) {
      console.error('Dexie error mirroring device_id', e);
    }
    return cookieValue;
  }

  // 3. Generate new UUID
  let newId: string;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    newId = crypto.randomUUID();
  } else {
    // Fallback pseudo-UUID
    newId = 'f-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 15);
  }

  try {
    await db.settings.put({ key: 'device_id', value: newId });
  } catch (e) {
    console.error('Dexie error saving device_id', e);
  }
  ensureCookie(newId);
  return newId;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const matches = document.cookie.match(new RegExp(
    "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
  ));
  return matches ? decodeURIComponent(matches[1]) : null;
}

function ensureCookie(value: string) {
  if (typeof document === 'undefined') return;
  const current = getCookie(COOKIE_NAME);
  if (!current) {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 10);
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; expires=${expiry.toUTCString()}; path=/; SameSite=Lax`;
  }
}
