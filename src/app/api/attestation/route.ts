import { json } from "@/lib/http";
import { verifyTeeAttestation, clearAttestationCache } from "@/lib/attestation";
import { isTeeOrE2ee } from "@/lib/privacy-router";
import type { PrivacyMode } from "@/lib/privacy-router";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") as PrivacyMode | null;
  const refresh = url.searchParams.get("refresh") === "1";

  if (refresh) clearAttestationCache();

  if (mode && isTeeOrE2ee(mode)) {
    const result = await verifyTeeAttestation(mode);
    return json(result);
  }

  const results = await Promise.all(
    (["tee", "e2ee"] as PrivacyMode[]).map(async (m) => {
      const r = await verifyTeeAttestation(m);
      return { mode: m, ...r };
    })
  );

  return json({ attestations: results });
}
