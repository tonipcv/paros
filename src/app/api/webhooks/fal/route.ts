import { createHash } from "node:crypto";
import { completeFalJob } from "@/lib/generation-jobs";
import { verifyFalWebhook } from "@/lib/fal-queue";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const raw = await request.text();
  if (!(await verifyFalWebhook(request.headers, raw).catch(() => false))) return Response.json({ error: "Invalid signature" }, { status: 401 });
  const eventId = request.headers.get("x-fal-webhook-request-id")!;
  const payloadHash = createHash("sha256").update(raw).digest("hex");
  const existing = await prisma.providerWebhookEvent.findUnique({ where: { provider_eventId: { provider: "fal", eventId } } });
  if (existing?.processed) return Response.json({ ok: true, duplicate: true });
  if (existing && existing.payloadHash !== payloadHash) return Response.json({ error: "Webhook payload mismatch" }, { status: 409 });
  const event = existing || await prisma.providerWebhookEvent.create({ data: { provider: "fal", eventId, payloadHash } });
  try {
    const body = JSON.parse(raw) as { request_id?: unknown; status?: unknown; payload?: unknown; error?: unknown };
    if (typeof body.request_id !== "string" || typeof body.status !== "string") throw new Error("Invalid fal webhook payload");
    await completeFalJob(body.request_id, body.status, body.payload && typeof body.payload === "object" ? body.payload as Record<string, unknown> : {}, typeof body.error === "string" ? body.error : undefined);
    await prisma.providerWebhookEvent.update({ where: { id: event.id }, data: { processed: true, processedAt: new Date(), error: null } });
    return Response.json({ ok: true });
  } catch (error) {
    await prisma.providerWebhookEvent.update({ where: { id: event.id }, data: { error: error instanceof Error ? error.message.slice(0, 2000) : String(error) } });
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
