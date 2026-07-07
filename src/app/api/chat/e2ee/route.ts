import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser, reserveCredits, refundCredits, recordUsage } from "@/lib/account";
import { error, json, handleRouteError } from "@/lib/http";
import { verifyTeeAttestation } from "@/lib/attestation";
import { endpoints } from "@/lib/privacy-router";
import { findChatModel } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

// E2EE proxy: the client has already sealed every message's content to the
// attested enclave (see lib/e2e-seal). We only verify attestation (fail-closed),
// charge credits, and relay the SEALED bytes to the enclave with the server-held
// key. The plaintext prompt and reply are never visible to this server.
const ALLOWED_HEADERS = ["x-e2ee-version", "x-client-pub-key", "x-model-pub-key", "x-e2ee-nonce", "x-e2ee-timestamp"];
const MAX_BODY_BYTES = 512 * 1024;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return error("Request body too large", 413);
    let body: {
      model?: unknown;
      creditModel?: unknown;
      messages?: unknown;
      e2eeHeaders?: Record<string, string>;
      max_tokens?: unknown;
    };
    try {
      body = JSON.parse(raw);
    } catch {
      return error("Invalid JSON body", 400);
    }

    // Credits are charged against the user-selected app model; the sealed `model`
    // is the enclave-hosted model id the request is actually routed to.
    const creditModel = findChatModel(typeof body.creditModel === "string" ? body.creditModel : "");
    if (!Array.isArray(body.messages) || body.messages.length === 0) return error("messages required");

    const ep = endpoints().e2ee;
    if (!ep) return error("E2EE provider not configured", 503);

    // Fail-closed: only forward once the enclave attestation is verified.
    const att = await verifyTeeAttestation("e2ee");
    if (!att.verified) {
      return error(`TEE attestation could not be verified (${att.reason || "unverified"}). Refusing to send.`, 502);
    }

    // Relay only the allowlisted E2EE headers supplied by the client.
    const e2eeHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.e2eeHeaders || {})) {
      if (ALLOWED_HEADERS.includes(k.toLowerCase()) && typeof v === "string") e2eeHeaders[k] = v;
    }
    if (!e2eeHeaders["X-E2EE-Nonce"] && !e2eeHeaders["x-e2ee-nonce"]) return error("Missing E2EE headers", 400);

    const teeModel = typeof body.model === "string" ? body.model : creditModel.id;
    const maxTokens = typeof body.max_tokens === "number" && body.max_tokens > 0 ? Math.min(body.max_tokens, 8192) : 2048;

    if (!(await reserveCredits(ws.id, creditModel.credits))) return error("Insufficient credits", 402);
    try {
      const upstream = await fetch(`${ep.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ep.apiKey}`,
          "Content-Type": "application/json",
          ...e2eeHeaders,
        },
        body: JSON.stringify({ model: teeModel, messages: body.messages, stream: true, max_tokens: maxTokens }),
      });
      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => "");
        console.error("E2EE enclave error", upstream.status, detail.slice(0, 300));
        await refundCredits(ws.id, creditModel.credits).catch((e) => console.error("refundCredits failed:", e));
        return error(`Enclave error (${upstream.status})`, 502);
      }
      await recordUsage(ws.id, "chat-e2ee", creditModel.id, creditModel.credits).catch((e) => console.error("recordUsage failed:", e));
      // Relay the still-encrypted SSE stream verbatim; the client decrypts each delta.
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Accel-Buffering": "no",
        },
      });
    } catch (e) {
      await refundCredits(ws.id, creditModel.credits).catch((refundErr) => console.error("refundCredits failed:", refundErr));
      throw e;
    }
  } catch (e) {
    return handleRouteError(e);
  }
}
