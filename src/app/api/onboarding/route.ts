import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const body = await request.json().catch(() => ({}));
    await prisma.workspace.update({
      where: { id: ws.id },
      data: {
        onboardingCompleted: true,
        name: body.workspaceName ? String(body.workspaceName).slice(0, 60) : ws.name,
      },
    });
    return json({ ok: true });
  } catch (e: any) {
    return error(e.message, 401);
  }
}
