import { createHash, timingSafeEqual } from "node:crypto";
import { expireCreditGrants } from "@/lib/credit-grants";

export const runtime = "nodejs";

function safeEqual(left: string, right: string) {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });
  const result = await expireCreditGrants();
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
