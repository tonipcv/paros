// Server-side TEE (Trusted Execution Environment) attestation.
//
// Before any prompt is allowed to reach a confidential-compute enclave, we
// verify that the enclave is genuine and running the expected code. This turns
// the "TEE / E2EE" privacy modes from a *policy* claim into a *technical* one:
// if attestation cannot be verified, we FAIL CLOSED and refuse — we never
// silently downgrade to a plaintext proxy.
//
// Flow (Phala dstack / Intel TDX compatible):
//   1. Fetch the enclave attestation report (a TDX/SGX quote) from the gateway.
//   2. Verify the quote through an attestation verifier (Phala's public verifier
//      by default, or a self-hosted one via TEE_VERIFIER_URL).
//   3. Extract the enclave public key bound in the quote's report_data — exposed
//      so clients can verify the enclave identity behind the E2EE mode.
//
// Everything is cached briefly and fails closed on any error.

import { isTeeOrE2ee, modeConfig, type PrivacyMode } from "./privacy-router";

export type AttestationResult = {
  verified: boolean;
  reason?: string;
  provider: string;
  enclavePublicKey?: string; // hex, secp256k1 raw uncompressed (04 + 64 bytes)
  measurement?: string; // mrenclave/mrtd style identity, when available
  verifiedAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { result: AttestationResult; expires: number }>();

function attestationUrl(baseUrl: string): string {
  if (process.env.TEE_ATTESTATION_URL) return process.env.TEE_ATTESTATION_URL;
  return `${baseUrl.replace(/\/$/, "")}/attestation/report`;
}

function verifierUrl(): string {
  return process.env.TEE_VERIFIER_URL || "https://cloud-api.phala.network/api/v1/attestations/verify";
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function fail(provider: string, reason: string): AttestationResult {
  return { verified: false, provider, reason, verifiedAt: Date.now() };
}

// Verify a TEE endpoint's attestation. Cached per (mode) for CACHE_TTL_MS.
export async function verifyTeeAttestation(mode: PrivacyMode): Promise<AttestationResult> {
  if (!isTeeOrE2ee(mode)) {
    return fail(mode, "Mode does not use a TEE");
  }
  const cfg = modeConfig(mode);
  const provider = cfg.label;

  if (process.env.TEE_ATTESTATION_DISABLED === "true") {
    // Explicit, auditable escape hatch for local dev only.
    return {
      verified: true,
      provider,
      reason: "attestation disabled (dev)",
      verifiedAt: Date.now(),
    };
  }

  const endpoint = cfg.endpoint;
  const apiKey = process.env.PHALA_E2EE_API_KEY || process.env.PHALA_TEE_API_KEY;
  if (!endpoint || !apiKey) {
    return fail(provider, "TEE provider not configured");
  }

  const cacheKey = `${mode}:${endpoint}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > now) return hit.result;

  let result: AttestationResult;
  try {
    // 1. Fetch the enclave quote.
    const reportRes = await fetchWithTimeout(attestationUrl(endpoint), {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!reportRes.ok) {
      result = fail(provider, `Attestation report unavailable (${reportRes.status})`);
    } else {
      const report = (await reportRes.json().catch(() => null)) as Record<string, unknown> | null;
      // Phala dstack / private-ai-gateway report: the raw TDX quote is a hex string
      // under `intel_quote` (or `evidence.quote`). Older/alt gateways may use `quote`.
      const evidence = report?.evidence as Record<string, unknown> | undefined;
      const quote = (report?.intel_quote ||
        evidence?.quote ||
        report?.quote ||
        report?.tdx_quote) as string | undefined;
      // The enclave public key the browser seals to. Phala binds a per-workload
      // E2EE key under attestation.workload_keyset.e2ee_public_keys[0].
      const workloadKeyset = (report?.attestation as Record<string, unknown> | undefined)?.workload_keyset as
        | { e2ee_public_keys?: { public_key?: string }[] }
        | undefined;
      const enclavePublicKey = (workloadKeyset?.e2ee_public_keys?.[0]?.public_key ||
        report?.signing_public_key ||
        report?.public_key ||
        report?.report_data_pubkey ||
        report?.enclave_public_key) as string | undefined;
      if (!quote) {
        result = fail(provider, "No quote in attestation report");
      } else {
        // 2. Verify the quote through the attestation verifier (Phala Cloud DCAP).
        const verifyRes = await fetchWithTimeout(verifierUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hex: quote }),
        });
        const verify = (await verifyRes.json().catch(() => null)) as Record<string, unknown> | null;
        const ok = verifyRes.ok && (verify?.success === true || verify?.verified === true);
        if (!ok) {
          result = fail(provider, (verify?.reason as string) || `Quote verification failed (${verifyRes.status})`);
        } else {
          const verifiedQuote = verify?.quote as { body?: Record<string, unknown> } | undefined;
          result = {
            verified: true,
            provider,
            enclavePublicKey,
            measurement: (verifiedQuote?.body?.mrtd ||
              verify?.mrtd ||
              verify?.mr_enclave ||
              report?.measurement) as string | undefined,
            verifiedAt: now,
          };
        }
      }
    }
  } catch (e) {
    const err = e as { name?: string; message?: string };
    result = fail(provider, err?.name === "AbortError" ? "Attestation timeout" : err?.message || "Attestation error");
  }

  cache.set(cacheKey, { result, expires: now + (result.verified ? CACHE_TTL_MS : 30_000) });
  return result;
}

export function clearAttestationCache() {
  cache.clear();
}
