import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json } from "@/lib/http";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    await prisma.apiKey.deleteMany({ where: { id, workspaceId: ws.id } });
    return json({ ok: true });
  } catch (e: any) {
    return error(e.message, 401);
  }
}
