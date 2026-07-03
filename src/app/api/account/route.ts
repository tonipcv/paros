import { currentUser, clearSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { error, json } from "@/lib/http";

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return error("Not authenticated", 401);
  const body = await request.json().catch(() => ({}));
  const name = body.name != null ? String(body.name).slice(0, 60) : undefined;
  const workspaceName = body.workspaceName != null ? String(body.workspaceName).slice(0, 60) : undefined;
  const privacyMode = typeof body.privacyMode === "boolean" ? body.privacyMode : undefined;
  if (name !== undefined) {
    await prisma.user.update({ where: { id: user.id }, data: { name } });
  }
  if (workspaceName !== undefined || privacyMode !== undefined) {
    await prisma.workspace.update({
      where: { userId: user.id },
      data: {
        ...(workspaceName !== undefined ? { name: workspaceName } : {}),
        ...(privacyMode !== undefined ? { privacyMode } : {}),
      },
    });
  }
  return json({ ok: true });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return error("Not authenticated", 401);
  await prisma.user.delete({ where: { id: user.id } });
  await clearSessionCookie();
  return json({ ok: true });
}
