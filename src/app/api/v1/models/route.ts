import { CHAT_MODELS } from "@/lib/models";
import { authenticateApiKey } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return Response.json({ error: { message: auth.message } }, { status: auth.status });
  }
  const data = CHAT_MODELS.map((m) => ({
    id: m.id,
    object: "model",
    created: 0,
    owned_by: m.provider.toLowerCase(),
  }));
  return Response.json({ object: "list", data });
}
