import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { error, json } from "@/lib/http";
import { findPlan, PLANS } from "@/lib/models";
import { logAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

const VALID_PLANS = PLANS.map((p) => p.id);

// PATCH /api/admin/users/[id]/plan — SUPER_ADMIN changes a user's plan.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin("SUPER_ADMIN");
    if (!admin) return error("Authentication required", 401);
    const { id: userId } = await params;
    const body = await request.json().catch(() => ({}));
    const planId = String(body.plan || "").toUpperCase();
    if (!VALID_PLANS.includes(planId as (typeof VALID_PLANS)[number])) return error(`Invalid plan. Must be one of: ${VALID_PLANS.join(", ")}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, workspace: { select: { id: true, plan: true, credits: true } } },
    });
    if (!user || !user.workspace) return error("User or workspace not found", 404);

    const plan = findPlan(planId);
    const previous = user.workspace.plan;
    const grantCredits = body.grantCredits !== false && planId !== "FREE";
    const newCredits = grantCredits ? user.workspace.credits + (plan?.credits ?? 0) : user.workspace.credits;

    // Use raw SQL to bypass Prisma enum strictness on the plan column.
    if (grantCredits) {
      await prisma.$executeRaw`UPDATE "workspaces" SET "plan" = ${planId}::"Plan", "credits" = ${newCredits} WHERE "id" = ${user.workspace.id}`;
    } else {
      await prisma.$executeRaw`UPDATE "workspaces" SET "plan" = ${planId}::"Plan" WHERE "id" = ${user.workspace.id}`;
    }

    await logAdminAction(
      { id: admin.id, email: admin.email },
      "change_plan",
      { userId: user.id, email: user.email },
      `${previous} → ${planId}` + (grantCredits ? ` (credits now ${newCredits})` : "")
    ).catch((e) => console.error("audit log failed:", e));
    return json({ ok: true, email: user.email, previous, plan: planId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    if (message === "Forbidden") return error("Forbidden", 403);
    console.error("admin plan error:", e);
    return error("Something went wrong", 500);
  }
}
