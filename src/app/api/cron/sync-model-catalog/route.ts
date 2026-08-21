import { createHash, timingSafeEqual } from "node:crypto";
import { syncBundledCatalog, syncOpenRouterCatalog } from "@/lib/catalog-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

function safeEqual(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const provider = new URL(request.url).searchParams.get("provider") || "openrouter";
  try {
    if (provider === "bundled") return Response.json({ results: await syncBundledCatalog() });
    if (provider === "openrouter") return Response.json({ results: [await syncOpenRouterCatalog()] });
    if (provider === "all") {
      const bundled = await syncBundledCatalog();
      const openrouter = await syncOpenRouterCatalog();
      return Response.json({ results: [...bundled, openrouter] });
    }
    return Response.json({ error: "provider must be bundled, openrouter, or all" }, { status: 400 });
  } catch (error) {
    console.error("model catalog sync failed:", error);
    return Response.json({ error: "Model catalog sync failed" }, { status: 502 });
  }
}
