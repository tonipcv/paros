"use client";

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomSaltB64(): string {
  return bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase) as unknown as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64ToBytes(saltB64) as unknown as BufferSource, iterations: 150000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(key: CryptoKey, plaintext: string): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    enc.encode(plaintext) as unknown as BufferSource
  );
  return { iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
}

export async function decryptText(key: CryptoKey, ivB64: string, ctB64: string): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(ivB64) as unknown as BufferSource },
    key,
    b64ToBytes(ctB64) as unknown as BufferSource
  );
  return dec.decode(pt);
}

// ---------------------------------------------------------------------------
// E2EE inference sealing (ECDH-ES + AES-256-GCM).
//
// For the "E2EE" privacy mode, the browser encrypts the prompt to the enclave's
// attested public key (obtained from a verified TEE attestation report). Only
// the enclave — never our server — can derive the shared secret and decrypt.
// This is the classic ephemeral-static ECDH envelope (HPKE-like).
// ---------------------------------------------------------------------------

export type SealedEnvelope = { epk: string; iv: string; ct: string };

// Import a P-256 raw uncompressed public key (65 bytes, base64) as an ECDH key.
async function importEnclavePublicKey(pubB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    b64ToBytes(pubB64) as unknown as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

// Encrypt plaintext to the enclave. Returns the ephemeral public key + ciphertext.
export async function sealToEnclave(enclavePubKeyB64: string, plaintext: string): Promise<SealedEnvelope> {
  const enclavePub = await importEnclavePublicKey(enclavePubKeyB64);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
  const shared = await crypto.subtle.deriveKey(
    { name: "ECDH", public: enclavePub },
    eph.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    shared,
    enc.encode(plaintext) as unknown as BufferSource
  );
  const epkRaw = await crypto.subtle.exportKey("raw", eph.publicKey);
  return { epk: bytesToB64(new Uint8Array(epkRaw)), iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
}

const CHECK_PHRASE = "htps-encryption-check-v1";

export async function makeCheckBlob(key: CryptoKey) {
  return encryptText(key, CHECK_PHRASE);
}

export async function verifyKey(key: CryptoKey, checkIv: string, checkCt: string): Promise<boolean> {
  try {
    const val = await decryptText(key, checkIv, checkCt);
    return val === CHECK_PHRASE;
  } catch {
    return false;
  }
}
