import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json, handleRouteError } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const conversation = await prisma.conversation.findFirst({
      where: { id, workspaceId: ws.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) return error("Not found", 404);
    return json({ conversation });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.temperature === "number") data.temperature = Math.max(0, Math.min(2, body.temperature));
    if (typeof body.systemPrompt === "string") data.systemPrompt = body.systemPrompt.slice(0, 4000);
    if (typeof body.title === "string") data.title = body.title.slice(0, 80);
    const result = await prisma.conversation.updateMany({ where: { id, workspaceId: ws.id }, data });
    if (result.count === 0) return error("Not found", 404);
    return json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    await prisma.conversation.deleteMany({ where: { id, workspaceId: ws.id } });
    return json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
