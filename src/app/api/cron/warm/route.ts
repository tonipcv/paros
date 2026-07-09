// Warming pings — called by the cron to keep Vercel serverless functions
// warm so the first user request does not pay a cold-start penalty.

export const runtime = "nodejs";
export const maxDuration = 30;

const PING_ENDPOINTS = [
  "/",
  "/api/attestation",
  "/api/models",
] as const;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  // Timing-safe not needed here — just a guard.
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012";
  const results: { path: string; status: number; ms: number }[] = [];

  for (const path of PING_ENDPOINTS) {
    const start = Date.now();
    try {
      const res = await fetch(`${base}${path}`, { method: "GET", signal: AbortSignal.timeout(15000) });
      results.push({ path, status: res.status, ms: Date.now() - start });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ path, status: 0, ms: Date.now() - start });
      console.error(`warm ping ${path} failed: ${msg}`);
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
