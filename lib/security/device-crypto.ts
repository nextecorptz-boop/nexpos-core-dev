import { db } from '@/lib/sync/db';
import { getOrCreateDeviceId } from '@/lib/sync/device';

export function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  try {
    const { webcrypto } = require('crypto');
    return webcrypto.subtle;
  } catch (e) {
    throw new Error('WebCrypto subtle is not available in this environment.');
  }
}

export const subtleCrypto: SubtleCrypto = new Proxy({} as SubtleCrypto, {
  get(_target, prop) {
    const crypto = getSubtleCrypto();
    const value = (crypto as any)[prop];
    if (typeof value === 'function') {
      return value.bind(crypto);
    }
    return value;
  }
});

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface DeviceKeyInfo {
  deviceId: string;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
}

/**
 * Generates an ECDSA P-256 keypair with a non-extractable private key.
 */
export async function generateDeviceKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  const keyPair = await subtleCrypto.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false, // private key is non-extractable (security requirement)
    ['sign', 'verify']
  );
  return keyPair;
}

/**
 * Loads or generates the device identity keypair.
 */
export async function getOrCreateDeviceKeys(): Promise<DeviceKeyInfo> {
  const deviceId = await getOrCreateDeviceId();
  
  if (!db.isOpen()) {
    await db.open();
  }

  const cachedPrivateKeyRecord = await db.settings.get('device_private_key');
  const cachedPublicKeyRecord = await db.settings.get('device_public_key');
  const cachedJwkRecord = await db.settings.get('device_public_key_jwk');

  if (cachedPrivateKeyRecord?.value && cachedPublicKeyRecord?.value && cachedJwkRecord?.value) {
    return {
      deviceId,
      privateKey: cachedPrivateKeyRecord.value as CryptoKey,
      publicKey: cachedPublicKeyRecord.value as CryptoKey,
      publicKeyJwk: cachedJwkRecord.value as JsonWebKey
    };
  }

  // Generate new keys
  const keyPair = await generateDeviceKeyPair();
  const publicKeyJwk = await subtleCrypto.exportKey('jwk', keyPair.publicKey);

  // Store in Dexie settings
  await db.settings.put({ key: 'device_private_key', value: keyPair.privateKey });
  await db.settings.put({ key: 'device_public_key', value: keyPair.publicKey });
  await db.settings.put({ key: 'device_public_key_jwk', value: publicKeyJwk });

  return {
    deviceId,
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicKeyJwk
  };
}

/**
 * Signs a string payload using the device's private key.
 */
export async function signPayload(payloadStr: string, privateKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payloadStr);

  const signatureBuffer = await subtleCrypto.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' }
    },
    privateKey,
    data
  );

  return arrayBufferToBase64(signatureBuffer);
}

/**
 * Verifies a signature against a payload using a public JWK.
 */
export async function verifyPayload(
  payloadStr: string,
  signatureBase64: string,
  publicKeyJwk: JsonWebKey
): Promise<boolean> {
  try {
    const publicKey = await subtleCrypto.importKey(
      'jwk',
      publicKeyJwk,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['verify']
    );

    const data = new TextEncoder().encode(payloadStr);
    const signature = base64ToArrayBuffer(signatureBase64);

    return await subtleCrypto.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      publicKey,
      signature,
      data
    );
  } catch (err) {
    console.error('Cryptographic verification error:', err);
    return false;
  }
}
