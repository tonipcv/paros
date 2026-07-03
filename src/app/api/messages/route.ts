import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json } from "@/lib/http";

// Persists client-side encrypted messages. Server stores only ciphertext.
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);

    const body = await request.json();
    const conversationId = String(body.conversationId || "");
    const items = Array.isArray(body.items) ? body.items : [];
    if (!conversationId || items.length === 0) return error("conversationId and items required");

    const convo = await prisma.conversation.findFirst({
      where: { id: conversationId, workspaceId: ws.id },
      select: { id: true },
    });
    if (!convo) return error("Conversation not found", 404);

    const data = items
      .filter((it: any) => (it.role === "user" || it.role === "assistant") && it.iv && it.ct)
      .map((it: any) => ({
        conversationId,
        role: it.role as string,
        content: String(it.ct),
        iv: String(it.iv),
        encrypted: true,
        model: it.model ? String(it.model) : null,
        attachments: Array.isArray(it.attachments) ? it.attachments : [],
      }));

    if (data.length === 0) return error("No valid items");

    await prisma.$transaction([
      prisma.message.createMany({ data }),
      prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    ]);
    return json({ ok: true, count: data.length });
  } catch (e: any) {
    return error(e.message, 401);
  }
}
