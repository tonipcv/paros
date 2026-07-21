import { CHAT_MODELS } from "@/lib/models";

export const runtime = "nodejs";

export async function GET() {
  const data = CHAT_MODELS.map((m) => ({
    id: m.id,
    object: "model",
    created: 0,
    owned_by: m.provider.toLowerCase(),
  }));
  return Response.json({ object: "list", data });
}
