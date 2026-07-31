import * as nodeCrypto from "node:crypto";

const ITERATIONS = 100000;
const KEY_LENGTH = 32;

function getCrypto() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  return nodeCrypto.webcrypto as any;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function deriveKey(pin: string, saltHex: string): Promise<CryptoKey> {
  const crypto = getCrypto();
  const encoder = new TextEncoder();
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const salt = hexToBuffer(saltHex);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH * 8 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(text: string, pin: string, saltHex: string): Promise<string> {
  if (!text) return text;
  const crypto = getCrypto();
  const encoder = new TextEncoder();
  const key = await deriveKey(pin, saltHex);
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(text)
  );

  return `${bufferToHex(iv)}:${bufferToHex(encryptedBuffer)}`;
}

export async function decrypt(encryptedText: string, pin: string, saltHex: string): Promise<string> {
  if (!encryptedText) return encryptedText;
  
  const parts = encryptedText.split(':');
  if (parts.length !== 2 && parts.length !== 3) throw new Error('Invalid encrypted format');
  
  const crypto = getCrypto();
  const decoder = new TextDecoder();
  const key = await deriveKey(pin, saltHex);
  
  const iv = hexToBuffer(parts[0]);
  let encryptedBuffer: Uint8Array;
  
  if (parts.length === 3) {
    // Old format with authTag appended
    const authTag = hexToBuffer(parts[1]);
    const encrypted = hexToBuffer(parts[2]);
    encryptedBuffer = new Uint8Array(encrypted.length + authTag.length);
    encryptedBuffer.set(encrypted, 0);
    encryptedBuffer.set(authTag, encrypted.length);
  } else {
    // New format (authTag is part of encryptedBuffer in Web Crypto AES-GCM)
    encryptedBuffer = hexToBuffer(parts[1]);
  }
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedBuffer
  );

  return decoder.decode(decryptedBuffer);
}

export async function hashPin(pin: string): Promise<{ salt: string; hash: string }> {
  const crypto = getCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bufferToHex(salt);
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  return { salt: saltHex, hash: bufferToHex(hashBuffer) };
}

export async function verifyPinHash(pin: string, saltHex: string, storedHash: string): Promise<boolean> {
  if (!saltHex || !storedHash) return false;
  
  const crypto = getCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const salt = hexToBuffer(saltHex);
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const newHash = bufferToHex(hashBuffer);
  return newHash === storedHash;
}
