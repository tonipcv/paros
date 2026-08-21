import { sendStats } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 30;

// Daily stats report to Telegram. Called by Vercel Cron (which sends
// `Authorization: Bearer $CRON_SECRET`) or manually with the same header.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sent = await sendStats();
  return Response.json({ ok: sent });
}
