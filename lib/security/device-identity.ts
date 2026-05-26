import { db } from '@/lib/sync/db';

export async function getDeviceFingerprint(): Promise<string> {
  const parts: string[] = [];

  if (typeof window !== 'undefined') {
    // Browser environment
    parts.push(window.navigator.userAgent || '');
    parts.push(window.navigator.language || '');
    try {
      parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    } catch (_) {}
    if (window.screen) {
      parts.push(`${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`);
    }
    
    // Canvas fingerprinting (supplemental entropy)
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 200;
        canvas.height = 50;
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("NEXPOS,trust,mesh.1.0", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("NEXPOS,trust,mesh.1.0", 4, 17);
        parts.push(canvas.toDataURL());
      }
    } catch (_) {
      // Ignored if canvas is blocked or disabled
    }
  } else {
    // Node environment (testing fallback)
    parts.push(process.platform || 'node');
    parts.push(process.arch || 'x64');
    parts.push(process.version || 'v20');
  }

  const combined = parts.join('|');
  return hashString(combined);
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  
  let hashBuffer: ArrayBuffer;
  
  // Resolve SubtleCrypto context-insensitively
  let subtleCrypto: SubtleCrypto | undefined;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    subtleCrypto = window.crypto.subtle;
  } else if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    subtleCrypto = globalThis.crypto.subtle;
  }

  if (subtleCrypto) {
    hashBuffer = await subtleCrypto.digest('SHA-256', data);
  } else {
    // Fallback for node testing if global crypto isn't set up yet
    try {
      const nodeCrypto = require('crypto');
      const hash = nodeCrypto.createHash('sha256');
      hash.update(str);
      return hash.digest('hex');
    } catch (err) {
      console.error('Failed to load node crypto fallback', err);
      // Utter fallback
      return 'fallback-' + Math.random().toString(36).substring(2, 15);
    }
  }

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
