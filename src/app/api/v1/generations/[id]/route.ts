import { authenticateApiKey } from "@/lib/api-auth";
import { refundCredits } from "@/lib/account";
import { cancelFalJob } from "@/lib/fal-queue";
import { prisma } from "@/lib/prisma";
import { releaseBillingReservation, requireBillingReconciliation } from "@/lib/billing-engine";

export const runtime = "nodejs";

function serialize(job: NonNullable<Awaited<ReturnType<typeof findJob>>>) {
  return { ...job, actualCostMicros: job.actualCostMicros.toString(), artifacts: job.artifacts.map((artifact) => ({ ...artifact, sizeBytes: artifact.sizeBytes?.toString() ?? null })) };
}

async function findJob(id: string, workspaceId: string) {
  return prisma.generationJob.findFirst({ where: { id, workspaceId }, include: { artifacts: true } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return Response.json({ error: { message: auth.message } }, { status: auth.status });
  const job = await findJob((await params).id, auth.workspace.id);
  return job ? Response.json(serialize(job), { headers: { "Cache-Control": "private, no-store" } }) : Response.json({ error: { message: "Generation job not found" } }, { status: 404 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return Response.json({ error: { message: auth.message } }, { status: auth.status });
  const job = await findJob((await params).id, auth.workspace.id);
  if (!job) return Response.json({ error: { message: "Generation job not found" } }, { status: 404 });
  if (["SUCCEEDED", "FAILED", "CANCELED"].includes(job.status)) return Response.json(serialize(job), { status: 409 });
  await prisma.generationJob.update({ where: { id: job.id }, data: { status: "CANCEL_REQUESTED" } });
  try {
    if (job.provider === "fal" && job.providerRequestId) await cancelFalJob(job.providerModelId, job.providerRequestId);
    await refundCredits(job.workspaceId, job.creditsReserved);
    if (job.billingLedgerId) await releaseBillingReservation(job.billingLedgerId).catch(() => undefined);
    const canceled = await prisma.generationJob.update({ where: { id: job.id }, data: { status: "CANCELED", completedAt: new Date(), progress: 100 }, include: { artifacts: true } });
    return Response.json(serialize(canceled));
  } catch (error) {
    if (job.billingLedgerId) await requireBillingReconciliation(job.billingLedgerId, job.providerRequestId || undefined).catch(() => undefined);
    await prisma.generationJob.update({ where: { id: job.id }, data: { status: "RECONCILIATION_REQUIRED", error: error instanceof Error ? error.message : String(error) } });
    return Response.json({ error: { message: "Cancellation could not be confirmed" } }, { status: 502 });
  }
}
