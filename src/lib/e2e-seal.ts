"use client";

// Real end-to-end encryption to the attested Phala/dstack enclave (ACI E2EE v2,
// secp256k1 suite). The browser seals each message's content to the enclave's
// attested secp256k1 public key; only the enclave can decrypt. Our server
// proxies the sealed bytes and never sees plaintext — not the prompt, not the
// reply.
//
// Wire format (ACI spec §7.1, as deployed by inference.phala.com):
//   - ECDH(secp256k1) -> shared x-coordinate (32 bytes)
//   - AES-256 key = HKDF-SHA256(salt=none, ikm=x, info="aci.e2ee.v2.secp256k1")
//   - field value = hex( ephPub(65, uncompressed SEC1) || iv(12) || ct || tag(16) )
//   - AAD (pipe-delimited, per deployed gateway commit):
//       request:  v2|req|algo=..|model=..|m=<i>|c=-|n=<nonce>|ts=<ts>
//       response: v2|resp|algo=..|model=..|id=<id>|choice=<i>|field=content|n=<nonce>|ts=<ts>

import { secp256k1 } from "@noble/curves/secp256k1";

const ALGO = "secp256k1-aes-256-gcm-hkdf-sha256";
const HKDF_INFO = new TextEncoder().encode("aci.e2ee.v2.secp256k1");
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

function toHex(b: Uint8Array): string {
  let o = "";
  for (const x of b) o += x.toString(16).padStart(2, "0");
  return o;
}
function fromHex(h: string): Uint8Array {
  const s = h.startsWith("0x") ? h.slice(2) : h;
  const o = new Uint8Array(s.length / 2);
  for (let i = 0; i < o.length; i++) o[i] = parseInt(s.substr(i * 2, 2), 16);
  return o;
}

const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

async function aesKey(shared: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  const hk = await subtle.importKey("raw", bs(shared), "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: bs(new Uint8Array(0)), info: bs(HKDF_INFO) },
    hk,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

async function sealField(serviceRaw: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Promise<string> {
  const ephPriv = secp256k1.utils.randomPrivateKey();
  const ephPub = secp256k1.getPublicKey(ephPriv, false); // 65-byte uncompressed
  const shared = secp256k1.getSharedSecret(ephPriv, serviceRaw).slice(1); // x-coord (32)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await subtle.encrypt({ name: "AES-GCM", iv: bs(iv), additionalData: bs(aad) }, await aesKey(shared, "encrypt"), bs(plaintext))
  );
  const blob = new Uint8Array(ephPub.length + iv.length + ct.length);
  blob.set(ephPub);
  blob.set(iv, ephPub.length);
  blob.set(ct, ephPub.length + iv.length);
  return toHex(blob);
}

async function openField(clientPriv: Uint8Array, blobHex: string, aad: Uint8Array): Promise<string> {
  const blob = fromHex(blobHex);
  const ephPub = blob.slice(0, 65);
  const iv = blob.slice(65, 77);
  const ctTag = blob.slice(77);
  const shared = secp256k1.getSharedSecret(clientPriv, ephPub).slice(1);
  const pt = await subtle.decrypt({ name: "AES-GCM", iv: bs(iv), additionalData: bs(aad) }, await aesKey(shared, "decrypt"), bs(ctTag));
  return dec.decode(pt);
}

const reqAad = (model: string, m: number, nonce: string, ts: number) =>
  enc.encode(`v2|req|algo=${ALGO}|model=${model}|m=${m}|c=-|n=${nonce}|ts=${ts}`);
const resAad = (model: string, id: string, choice: number, field: string, nonce: string, ts: number) =>
  enc.encode(`v2|resp|algo=${ALGO}|model=${model}|id=${id}|choice=${choice}|field=${field}|n=${nonce}|ts=${ts}`);

export type SealedMessage = { role: string; content: string };

export type SealedRequest = {
  messages: SealedMessage[];
  headers: Record<string, string>;
  // Secrets/context kept in memory to decrypt the reply:
  clientPrivHex: string;
  model: string;
  nonce: string;
  ts: number;
};

// Seal every message's string content to the enclave. Returns the sealed
// messages plus the X-E2EE-* headers the gateway needs to derive keys.
export async function sealChat(
  enclavePublicKeyHex: string,
  model: string,
  messages: { role: string; content: string }[]
): Promise<SealedRequest> {
  const serviceRaw = fromHex(enclavePublicKeyHex);
  const clientPriv = secp256k1.utils.randomPrivateKey();
  const clientPub = secp256k1.getPublicKey(clientPriv, false);
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const ts = Math.floor(Date.now() / 1000);

  const sealed = await Promise.all(
    messages.map(async (msg, i) => {
      if (typeof msg.content !== "string") return { role: msg.role, content: msg.content };
      const content = await sealField(serviceRaw, enc.encode(msg.content), reqAad(model, i, nonce, ts));
      return { role: msg.role, content };
    })
  );

  return {
    messages: sealed,
    headers: {
      "X-E2EE-Version": "2",
      "X-Client-Pub-Key": toHex(clientPub),
      "X-Model-Pub-Key": enclavePublicKeyHex,
      "X-E2EE-Nonce": nonce,
      "X-E2EE-Timestamp": String(ts),
    },
    clientPrivHex: toHex(clientPriv),
    model,
    nonce,
    ts,
  };
}

// Decrypt the enclave's reply for choice 0's message content (buffered).
export async function openChatReply(
  session: Pick<SealedRequest, "clientPrivHex" | "model" | "nonce" | "ts">,
  response: { id?: string; choices?: { message?: { content?: string } }[] }
): Promise<string> {
  const id = typeof response.id === "string" ? response.id : "";
  const raw = response.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("No content in enclave reply");
  const clientPriv = fromHex(session.clientPrivHex);
  const aad = resAad(session.model, id, 0, "content", session.nonce, session.ts);
  return openField(clientPriv, raw, aad);
}

// Decrypt one streamed SSE delta's sealed `content` field.
export async function openStreamDelta(
  session: Pick<SealedRequest, "clientPrivHex" | "model" | "nonce" | "ts">,
  id: string,
  choiceIndex: number,
  blobHex: string
): Promise<string> {
  const aad = resAad(session.model, id, choiceIndex, "content", session.nonce, session.ts);
  return openField(fromHex(session.clientPrivHex), blobHex, aad);
}
