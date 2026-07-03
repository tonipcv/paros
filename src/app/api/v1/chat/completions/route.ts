import { chargeCredits } from "@/lib/account";
import { hasOpenRouter } from "@/lib/openrouter";
import { findChatModel } from "@/lib/models";
import { authenticateApiKey } from "@/lib/api-auth";

export const runtime = "nodejs";

const BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return Response.json(
      { error: { message: auth.message } },
      { status: auth.status, headers: auth.retryAfter ? { "Retry-After": String(auth.retryAfter) } : {} }
    );
  }
  if (!hasOpenRouter()) {
    return Response.json({ error: { message: "Inference backend not configured" } }, { status: 503 });
  }

  const body = await request.json();
  const model = findChatModel(body.model || "");
  if (auth.workspace.credits < model.credits) {
    return Response.json({ error: { message: "Insufficient credits" } }, { status: 402 });
  }

  const upstream = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, model: model.id }),
  });

  await chargeCredits(auth.workspace.id, "api", model.id, model.credits).catch(() => {});

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-cache",
    },
  });
}
