import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/admin-audit";
import { error, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin("SUPER_ADMIN");
    if (!admin) return error("Authentication required", 401);
    const { id: userId } = await params;
    const body = await request.json().catch(() => null) as { providerAccess?: unknown; isInternal?: unknown } | null;
    if (!body || typeof body.providerAccess !== "boolean" || typeof body.isInternal !== "boolean") {
      return error("providerAccess and isInternal must be booleans");
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, workspace: { select: { id: true, providerAccess: true, isInternal: true } } },
    });
    if (!user?.workspace) return error("User or workspace not found", 404);
    const workspace = await prisma.workspace.update({
      where: { id: user.workspace.id },
      data: { providerAccess: body.providerAccess, isInternal: body.isInternal },
      select: { id: true, providerAccess: true, isInternal: true },
    });
    await logAdminAction(
      { id: admin.id, email: admin.email }, "set_provider_access",
      { userId: user.id, email: user.email },
      `providerAccess ${user.workspace.providerAccess} → ${workspace.providerAccess}; isInternal ${user.workspace.isInternal} → ${workspace.isInternal}`,
    );
    return json({ ok: true, workspace });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed";
    if (message === "Forbidden") return error("Forbidden", 403);
    console.error("provider access update failed:", cause);
    return error("Something went wrong", 500);
  }
}
