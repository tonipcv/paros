import { prisma } from "./prisma";

type ActionType = "promote_user" | "set_credits" | "change_plan" | "health_check" | "test_email";

export async function logAdminAction(
  admin: { id: string; email: string },
  action: ActionType,
  target?: { userId: string; email: string },
  details?: string
): Promise<void> {
  await prisma.adminAction
    .create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action,
        targetUserId: target?.userId ?? null,
        targetEmail: target?.email ?? null,
        details: details ?? null,
      },
    })
    .catch((e) => console.error("admin action log failed:", e));
}

export async function getRecentActions(limit = 50) {
  return prisma.adminAction.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      adminEmail: true,
      action: true,
      targetEmail: true,
      details: true,
      createdAt: true,
    },
  });
}
