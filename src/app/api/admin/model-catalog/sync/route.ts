import { logAdminAction } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth";
import { syncBundledCatalog, syncOpenRouterCatalog } from "@/lib/catalog-sync";
import { error, json } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin("SUPER_ADMIN");
    if (!admin) return error("Authentication required", 401);
    const body = await request.json().catch(() => ({}));
    const source = String(body.source || "all").toLowerCase();
    if (!["all", "openrouter", "bundled"].includes(source)) return error("Invalid sync source");
    const results: unknown[] = [];
    if (source === "all" || source === "openrouter") results.push(await syncOpenRouterCatalog());
    if (source === "all" || source === "bundled") results.push(...await syncBundledCatalog());
    await logAdminAction({ id: admin.id, email: admin.email }, "sync_model_catalog", undefined, `${source}: ${results.length} provider runs`);
    return json({ ok: true, source, results });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed";
    if (message === "Forbidden") return error("Forbidden", 403);
    if (message === "Authentication required") return error(message, 401);
    console.error("model catalog sync failed:", cause);
    return error("Catalog synchronization failed", 502);
  }
}
