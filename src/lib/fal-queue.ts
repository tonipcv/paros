import { createHash, createPublicKey, verify } from "node:crypto";

const FAL_QUEUE_URL = "https://queue.fal.run";
const FAL_JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
let jwksCache: { expiresAt: number; keys: Array<{ x: string }> } | null = null;

function key() {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured");
  return process.env.FAL_KEY;
}

export async function submitFalJob(modelId: string, input: Record<string, unknown>, webhookUrl?: string) {
  const query = webhookUrl ? `?fal_webhook=${encodeURIComponent(webhookUrl)}` : "";
  const response = await fetch(`${FAL_QUEUE_URL}/${modelId}${query}`, {
    method: "POST",
    headers: { Authorization: `Key ${key()}`, "Content-Type": "application/json", "X-Fal-Store-IO": "0" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`fal queue submission failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const data = await response.json() as { request_id?: unknown; status_url?: unknown; response_url?: unknown; cancel_url?: unknown };
  if (typeof data.request_id !== "string") throw new Error("fal queue returned no request_id");
  return { requestId: data.request_id, statusUrl: String(data.status_url || ""), responseUrl: String(data.response_url || ""), cancelUrl: String(data.cancel_url || "") };
}

export async function cancelFalJob(modelId: string, requestId: string) {
  const response = await fetch(`${FAL_QUEUE_URL}/${modelId}/requests/${encodeURIComponent(requestId)}/cancel`, {
    method: "PUT", headers: { Authorization: `Key ${key()}` }, signal: AbortSignal.timeout(15_000),
  });
  if (![200, 202, 400].includes(response.status)) throw new Error(`fal cancellation failed (${response.status})`);
  return response.json().catch(() => ({}));
}

async function falJwks() {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetch(FAL_JWKS_URL, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`fal JWKS request failed (${response.status})`);
  const payload = await response.json() as { keys?: Array<{ x?: unknown }> };
  const keys = (payload.keys || []).filter((item): item is { x: string } => typeof item.x === "string");
  if (!keys.length) throw new Error("fal JWKS contains no Ed25519 keys");
  jwksCache = { expiresAt: Date.now() + 24 * 60 * 60 * 1000, keys };
  return keys;
}

export async function verifyFalWebhook(headers: Headers, rawBody: string) {
  const requestId = headers.get("x-fal-webhook-request-id");
  const userId = headers.get("x-fal-webhook-user-id");
  const timestamp = headers.get("x-fal-webhook-timestamp");
  const signature = headers.get("x-fal-webhook-signature");
  if (!requestId || !userId || !timestamp || !signature || !/^\d+$/.test(timestamp) || !/^[a-f\d]+$/i.test(signature)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const message = Buffer.from([requestId, userId, timestamp, bodyHash].join("\n"), "utf8");
  const signatureBytes = Buffer.from(signature, "hex");
  for (const jwk of await falJwks()) {
    try {
      const publicKey = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: jwk.x }, format: "jwk" });
      if (verify(null, message, publicKey, signatureBytes)) return true;
    } catch { /* try the next rotated key */ }
  }
  return false;
}
