import { getAddress, getBytes, hexlify, toBeHex, zeroPadValue } from 'ethers';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function deriveKey(address: string): Promise<CryptoKey> {
  const bytes = getBytes(getAddress(address));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptWithAddress(address: string, plaintext: string): Promise<string> {
  const key = await deriveKey(address);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = textEncoder.encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return hexlify(combined);
}

export async function decryptWithAddress(address: string, payload: string): Promise<string> {
  const key = await deriveKey(address);
  const bytes = getBytes(payload);
  if (bytes.length < 13) {
    throw new Error('Invalid payload length');
  }
  const iv = bytes.slice(0, 12);
  const cipher = bytes.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return textDecoder.decode(plain);
}

export function normalizeDecryptedAddress(value: string): string {
  if (value.startsWith('0x')) {
    return getAddress(value);
  }

  const numeric = BigInt(value);
  const padded = zeroPadValue(toBeHex(numeric), 20);
  return getAddress(padded);
}
