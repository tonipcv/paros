import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/models";
import { timingSafeEqual, createHash } from "node:crypto";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Resets credits for all FREE-tier workspaces to the FREE plan's base credits.
// Protect with a shared secret so only the cron scheduler can call it.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const freePlan = PLANS.find((p) => p.id === "FREE");
  const baseCredits = freePlan?.credits ?? 10;

  const result = await prisma.workspace.updateMany({
    where: { plan: "FREE" },
    data: { credits: baseCredits },
  });

  return new Response(JSON.stringify({ reset: result.count, credits: baseCredits }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
