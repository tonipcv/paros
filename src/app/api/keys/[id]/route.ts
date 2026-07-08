import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json, handleRouteError } from "@/lib/http";
import { sendApiKeyRevokedEmail } from "@/lib/emails";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const key = await prisma.apiKey.findFirst({ where: { id, workspaceId: ws.id }, select: { name: true } });
    const result = await prisma.apiKey.deleteMany({ where: { id, workspaceId: ws.id } });
    if (result.count > 0 && key && user.email) {
      sendApiKeyRevokedEmail(user.email, key.name).catch((e) => console.error("api key revoked email failed:", e));
    }
    return json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
