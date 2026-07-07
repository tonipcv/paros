import assert from "node:assert/strict";
import { secp256k1 } from "@noble/curves/secp256k1";
import { sealChat, openStreamDelta, openChatReply } from "../src/lib/e2e-seal";

// Round-trip interop test for real E2EE (ACI v2, secp256k1 suite). The test
// plays the role of the enclave: it decrypts the client's sealed request with
// the enclave private key and re-encrypts a reply to the client's public key,
// independently re-implementing the wire format (spec §7.1). If lib/e2e-seal
// ever drifts from the spec (curve, HKDF info, AAD, blob layout), these fail.

const ALGO = "secp256k1-aes-256-gcm-hkdf-sha256";
const HKDF_INFO = new TextEncoder().encode("aci.e2ee.v2.secp256k1");
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => {
  const s = h.startsWith("0x") ? h.slice(2) : h;
  const o = new Uint8Array(s.length / 2);
  for (let i = 0; i < o.length; i++) o[i] = parseInt(s.substr(i * 2, 2), 16);
  return o;
};

async function aesKey(shared: Uint8Array, usage: KeyUsage) {
  const hk = await subtle.importKey("raw", shared as unknown as BufferSource, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0) as unknown as BufferSource, info: HKDF_INFO as unknown as BufferSource },
    hk,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

// Enclave side: decrypt a field sealed to `enclavePriv`.
async function enclaveDecrypt(enclavePriv: Uint8Array, blobHex: string, aad: Uint8Array): Promise<string> {
  const blob = fromHex(blobHex);
  const shared = secp256k1.getSharedSecret(enclavePriv, blob.slice(0, 65)).slice(1);
  const pt = await subtle.decrypt(
    { name: "AES-GCM", iv: blob.slice(65, 77) as unknown as BufferSource, additionalData: aad as unknown as BufferSource },
    await aesKey(shared, "decrypt"),
    blob.slice(77) as unknown as BufferSource
  );
  return dec.decode(pt);
}

// Enclave side: seal a reply to the client's public key.
async function enclaveSeal(clientPubHex: string, plaintext: string, aad: Uint8Array): Promise<string> {
  const clientPub = fromHex(clientPubHex);
  const ephPriv = secp256k1.utils.randomPrivateKey();
  const ephPub = secp256k1.getPublicKey(ephPriv, false);
  const shared = secp256k1.getSharedSecret(ephPriv, clientPub).slice(1);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource, additionalData: aad as unknown as BufferSource },
      await aesKey(shared, "encrypt"),
      enc.encode(plaintext) as unknown as BufferSource
    )
  );
  const out = new Uint8Array(65 + 12 + ct.length);
  out.set(ephPub);
  out.set(iv, 65);
  out.set(ct, 77);
  return toHex(out);
}

const reqAad = (model: string, m: number, nonce: string, ts: number) =>
  enc.encode(`v2|req|algo=${ALGO}|model=${model}|m=${m}|c=-|n=${nonce}|ts=${ts}`);
const resAad = (model: string, id: string, ch: number, field: string, nonce: string, ts: number) =>
  enc.encode(`v2|resp|algo=${ALGO}|model=${model}|id=${id}|choice=${ch}|field=${field}|n=${nonce}|ts=${ts}`);

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

async function main() {
  const enclavePriv = secp256k1.utils.randomPrivateKey();
  const enclavePubHex = toHex(secp256k1.getPublicKey(enclavePriv, false));
  const model = "meta-llama/llama-3.3-70b-instruct";

  await test("sealChat produces the ACI v2 secp256k1 headers", async () => {
    const sealed = await sealChat(enclavePubHex, model, [{ role: "user", content: "hi" }]);
    assert.equal(sealed.headers["X-E2EE-Version"], "2");
    assert.equal(sealed.headers["X-Model-Pub-Key"], enclavePubHex);
    assert.equal(sealed.headers["X-E2EE-Nonce"].length, 64);
    assert.match(sealed.headers["X-Client-Pub-Key"], /^04[0-9a-f]{128}$/);
    assert.ok(Number(sealed.headers["X-E2EE-Timestamp"]) > 0);
  });

  await test("the enclave can decrypt every sealed request message", async () => {
    const msgs = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "What is 2+2? Reply concisely." },
    ];
    const sealed = await sealChat(enclavePubHex, model, msgs);
    for (let i = 0; i < msgs.length; i++) {
      // Sealed content must be opaque hex, not the plaintext.
      assert.notEqual(sealed.messages[i].content, msgs[i].content);
      assert.match(sealed.messages[i].content, /^[0-9a-f]+$/);
      const opened = await enclaveDecrypt(
        enclavePriv,
        sealed.messages[i].content,
        reqAad(model, i, sealed.headers["X-E2EE-Nonce"], Number(sealed.headers["X-E2EE-Timestamp"]))
      );
      assert.equal(opened, msgs[i].content);
    }
  });

  await test("the client opens a buffered enclave reply", async () => {
    const sealed = await sealChat(enclavePubHex, model, [{ role: "user", content: "ping" }]);
    const id = "chatcmpl-test-1";
    const reply = "pong from the enclave";
    const sealedReply = await enclaveSeal(
      sealed.headers["X-Client-Pub-Key"],
      reply,
      resAad(model, id, 0, "content", sealed.headers["X-E2EE-Nonce"], Number(sealed.headers["X-E2EE-Timestamp"]))
    );
    const opened = await openChatReply(sealed, { id, choices: [{ message: { content: sealedReply } }] });
    assert.equal(opened, reply);
  });

  await test("the client opens streamed enclave deltas in order", async () => {
    const sealed = await sealChat(enclavePubHex, model, [{ role: "user", content: "count" }]);
    const id = "chatcmpl-test-2";
    const parts = ["1", "\n2", "\n3"];
    let out = "";
    for (const part of parts) {
      const sealedDelta = await enclaveSeal(
        sealed.headers["X-Client-Pub-Key"],
        part,
        resAad(model, id, 0, "content", sealed.headers["X-E2EE-Nonce"], Number(sealed.headers["X-E2EE-Timestamp"]))
      );
      out += await openStreamDelta(sealed, id, 0, sealedDelta);
    }
    assert.equal(out, "1\n2\n3");
  });

  await test("a tampered ciphertext fails authentication (AEAD)", async () => {
    const sealed = await sealChat(enclavePubHex, model, [{ role: "user", content: "secret" }]);
    const c = sealed.messages[0].content;
    // Flip the last ciphertext byte.
    const tampered = c.slice(0, -2) + (c.slice(-2) === "00" ? "01" : "00");
    await assert.rejects(() =>
      enclaveDecrypt(enclavePriv, tampered, reqAad(model, 0, sealed.headers["X-E2EE-Nonce"], Number(sealed.headers["X-E2EE-Timestamp"])))
    );
  });

  await test("wrong AAD (nonce) fails to decrypt — AAD binding holds", async () => {
    const sealed = await sealChat(enclavePubHex, model, [{ role: "user", content: "bound" }]);
    await assert.rejects(() =>
      enclaveDecrypt(enclavePriv, sealed.messages[0].content, reqAad(model, 0, "0".repeat(64), Number(sealed.headers["X-E2EE-Timestamp"])))
    );
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
