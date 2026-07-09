import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { error, json } from "@/lib/http";
import { logAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

type RoleVal = "USER" | "ADMIN" | "SUPER_ADMIN";
const VALID_ROLES: RoleVal[] = ["USER", "ADMIN", "SUPER_ADMIN"];

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin("SUPER_ADMIN");
    if (!admin) return error("Authentication required", 401);
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || "");
    const role = String(body.role || "").toUpperCase();
    if (!VALID_ROLES.includes(role as RoleVal)) return error(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`);
    if (userId === admin.id) return error("You cannot change your own role", 400);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!user) return error("User not found", 404);

    await prisma.user.update({ where: { id: userId }, data: { role: role as "USER" | "ADMIN" | "SUPER_ADMIN" } });
    await logAdminAction(
      { id: admin.id, email: admin.email },
      "promote_user",
      { userId: user.id, email: user.email },
      `Role changed to ${role}`
    ).catch((e) => console.error("audit log failed:", e));
    return json({ ok: true, user: { id: user.id, email: user.email, role } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    if (message === "Forbidden") return error("Forbidden", 403);
    if (message === "Authentication required") return error("Authentication required", 401);
    console.error("admin update role error:", e);
    return error("Something went wrong", 500);
  }
}
