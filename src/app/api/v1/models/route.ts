import type { CatalogStatus, ModelModality } from "@prisma/client";
import { authenticateApiKey } from "@/lib/api-auth";
import { CATALOG_PAGE_MAX, listCatalogModels } from "@/lib/model-catalog";

export const runtime = "nodejs";

const modalities = new Set<ModelModality>(["TEXT", "IMAGE", "VIDEO", "AUDIO", "EMBEDDING", "MUSIC", "UPSCALE", "INPAINT", "ASR", "TTS"]);
const statuses = new Set<CatalogStatus>(["DRAFT", "ACTIVE", "DEGRADED", "OFFLINE", "DEPRECATED"]);

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return Response.json(
      { error: { message: auth.message, type: "authentication_error", code: "invalid_api_key" } },
      { status: auth.status, headers: auth.retryAfter ? { "Retry-After": String(auth.retryAfter) } : {} }
    );
  }
  const params = new URL(request.url).searchParams;
  const rawType = (params.get("type") || "TEXT").toUpperCase() as ModelModality;
  const rawStatus = (params.get("status") || "ACTIVE").toUpperCase() as CatalogStatus;
  if (params.get("type") !== "all" && !modalities.has(rawType)) {
    return Response.json({ error: { message: "Invalid model type", param: "type", code: "invalid_type" } }, { status: 400 });
  }
  if (!statuses.has(rawStatus)) return Response.json({ error: { message: "Invalid model status", param: "status" } }, { status: 400 });
  const requestedLimit = Number(params.get("limit") || 100);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > CATALOG_PAGE_MAX) {
    return Response.json({ error: { message: `limit must be between 1 and ${CATALOG_PAGE_MAX}`, param: "limit" } }, { status: 400 });
  }
  const result = await listCatalogModels({
    modality: params.get("type") === "all" ? undefined : rawType,
    status: rawStatus,
    capability: params.get("capability") || undefined,
    provider: params.get("provider") || undefined,
    search: params.get("search") || undefined,
    cursor: params.get("cursor") || undefined,
    limit: requestedLimit,
  });
  return Response.json(
    { object: "list", type: params.get("type") || "text", data: result.data, next_cursor: result.nextCursor, has_more: Boolean(result.nextCursor) },
    { headers: { "Cache-Control": "private, max-age=30", "X-Catalog-Source": result.source } }
  );
}
