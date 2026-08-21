import { createHash, timingSafeEqual } from "node:crypto";
import { persistPendingArtifacts } from "@/lib/artifact-persistence";

export const runtime = "nodejs";
export const maxDuration = 300;

function safeEqual(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(request.headers.get("authorization") || "", `Bearer ${secret}`)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await persistPendingArtifacts(10));
}
