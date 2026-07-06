import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser, chargeCredits } from "@/lib/account";
import { json, error } from "@/lib/http";
import { verifyTeeAttestation } from "@/lib/attestation";
import { endpoints, modeConfig } from "@/lib/privacy-router";
import { findChatModel } from "@/lib/models";

export const runtime = "nodejs";

// Mints a short-lived, direct-to-enclave session for E2EE mode.
//
// In E2EE mode the browser talks DIRECTLY to the attested enclave — our server
// is never in the prompt's data path, so it cannot see plaintext even in transit.
// We only (a) verify the enclave attestation, (b) return the enclave public key
// so the client can seal its payload, and (c) charge credits up front.
//
// NOTE: the returned apiKey must be a scoped/restricted enclave key, since it is
// handed to the browser. Configure PHALA_E2EE_API_KEY accordingly.
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return error("Authentication required", 401);
  }

  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return error("Workspace not found", 404);

  const body = await request.json().catch(() => ({}));
  const model = findChatModel(body.model || "");
  if (ws.credits < model.credits) return error("Insufficient credits", 402);

  const att = await verifyTeeAttestation("e2ee");
  if (!att.verified) {
    return error(`TEE attestation could not be verified (${att.reason || "unverified"}).`, 502);
  }
  if (!att.enclavePublicKey) {
    return error("Enclave did not expose a public key for E2EE sealing.", 502);
  }

  const ep = endpoints().e2ee;
  if (!ep) return error("E2EE provider not configured", 503);

  // Charge up front — the server won't observe the direct request.
  await chargeCredits(ws.id, "chat", model.id, model.credits).catch(() => {});

  return json({
    baseUrl: ep.baseUrl,
    apiKey: ep.apiKey,
    model: model.id.replace(/^(openrouter|teeprovider)\//, ""),
    enclavePublicKey: att.enclavePublicKey,
    provider: modeConfig("e2ee").label,
    attestation: { verified: att.verified, measurement: att.measurement, verifiedAt: att.verifiedAt },
  });
}
