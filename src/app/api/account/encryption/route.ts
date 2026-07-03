import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    return json({
      encEnabled: ws.encEnabled,
      salt: ws.encSalt,
      checkIv: ws.encCheckIv,
      checkCt: ws.encCheckCt,
    });
  } catch (e: any) {
    return error(e.message, 401);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    if (ws.encEnabled) return error("Encryption already enabled", 400);

    const body = await request.json();
    const { salt, checkIv, checkCt } = body;
    if (!salt || !checkIv || !checkCt) return error("salt, checkIv, checkCt required");

    await prisma.workspace.update({
      where: { id: ws.id },
      data: { encEnabled: true, encSalt: salt, encCheckIv: checkIv, encCheckCt: checkCt },
    });
    return json({ ok: true });
  } catch (e: any) {
    return error(e.message, 401);
  }
}
