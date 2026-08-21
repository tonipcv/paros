import { authenticateApiKey } from "@/lib/api-auth";
import { createGenerationJob, modalityForOperation } from "@/lib/generation-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

function serialize(job: Awaited<ReturnType<typeof createGenerationJob>>) {
  return { ...job, actualCostMicros: job.actualCostMicros.toString(), artifacts: job.artifacts.map((artifact) => ({ ...artifact, sizeBytes: artifact.sizeBytes?.toString() ?? null })) };
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return Response.json({ error: { message: auth.message } }, { status: auth.status });
  const body = await request.json().catch(() => null) as { model?: unknown; operation?: unknown; input?: unknown } | null;
  if (!body || typeof body.model !== "string" || typeof body.operation !== "string" || !body.input || typeof body.input !== "object" || Array.isArray(body.input)) {
    return Response.json({ error: { message: "model, operation and input object are required" } }, { status: 400 });
  }
  if (!modalityForOperation(body.operation)) return Response.json({ error: { message: "Unsupported operation" } }, { status: 400 });
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const baseUrl = configuredBaseUrl || (process.env.NODE_ENV === "development" ? new URL(request.url).origin : "");
  if (!baseUrl) return Response.json({ error: { message: "Public application URL is not configured" } }, { status: 503 });
  try {
    const job = await createGenerationJob({
      workspaceId: auth.workspace.id, modelId: body.model, operation: body.operation,
      input: body.input as Record<string, unknown>, idempotencyKey: request.headers.get("idempotency-key") || undefined, baseUrl,
    });
    return Response.json(serialize(job), { status: 202, headers: { Location: `${baseUrl}/api/v1/generations/${job.id}` } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation submission failed";
    const status = message === "Insufficient credits" ? 402 : /not found/i.test(message) ? 404 : /unsupported|required|configured/i.test(message) ? 400 : 502;
    return Response.json({ error: { message } }, { status });
  }
}
