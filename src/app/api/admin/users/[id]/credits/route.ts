import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { error, json } from "@/lib/http";
import { logAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

// PATCH /api/admin/users/[id]/credits — SUPER_ADMIN adjusts credits.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin("SUPER_ADMIN");
    if (!admin) return error("Authentication required", 401);
    const { id: userId } = await params;
    const body = await request.json().catch(() => ({}));
    const delta = Number(body.delta);
    if (!Number.isInteger(delta)) return error("delta must be an integer");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, workspace: { select: { id: true, credits: true } } },
    });
    if (!user || !user.workspace) return error("User or workspace not found", 404);

    const newCredits = Math.max(0, user.workspace.credits + delta);
    await prisma.workspace.update({ where: { id: user.workspace.id }, data: { credits: newCredits } });
    await logAdminAction(
      { id: admin.id, email: admin.email },
      "set_credits",
      { userId: user.id, email: user.email },
      `${delta >= 0 ? "+" : ""}${delta} credits (${user.workspace.credits} → ${newCredits})`
    ).catch((e) => console.error("audit log failed:", e));
    return json({ ok: true, email: user.email, previous: user.workspace.credits, credits: newCredits });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    if (message === "Forbidden") return error("Forbidden", 403);
    console.error("admin credits error:", e);
    return error("Something went wrong", 500);
  }
}
