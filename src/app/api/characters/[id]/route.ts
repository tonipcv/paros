import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.name != null) data.name = String(body.name).slice(0, 60);
    if (body.tagline != null) data.tagline = String(body.tagline).slice(0, 120);
    if (body.emoji != null) data.emoji = String(body.emoji).slice(0, 8);
    if (body.systemPrompt != null) data.systemPrompt = String(body.systemPrompt).slice(0, 4000);
    if (body.greeting != null) data.greeting = String(body.greeting).slice(0, 1000);
    if (body.model != null) data.model = String(body.model);
    const result = await prisma.character.updateMany({ where: { id, workspaceId: ws.id }, data });
    if (result.count === 0) return error("Not found", 404);
    return json({ ok: true });
  } catch (e: any) {
    return error(e.message, 401);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    await prisma.character.deleteMany({ where: { id, workspaceId: ws.id } });
    return json({ ok: true });
  } catch (e: any) {
    return error(e.message, 401);
  }
}
