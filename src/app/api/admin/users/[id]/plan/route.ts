import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { error, json } from "@/lib/http";
import { findPlan, PLANS } from "@/lib/models";
import { grantCredits } from "@/lib/credit-grants";
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
    const shouldGrant = body.grantCredits !== false && planId !== "FREE";

    // Use raw SQL to bypass Prisma enum strictness on the plan column.
    await prisma.$executeRaw`UPDATE "workspaces" SET "plan" = ${planId}::"Plan" WHERE "id" = ${user.workspace.id}`;

    // Credits go through a real CreditGrant so they are tracked, capped and
    // expire like every other grant — never an untracked flat increment.
    let creditsGranted = 0;
    if (shouldGrant) {
      const { creditsAdded } = await grantCredits({
        workspaceId: user.workspace.id,
        source: "ADMIN",
        credits: plan?.credits ?? 0,
        monthlyAllowance: plan?.credits ?? 0,
        metadata: { actor: admin.email, previousPlan: previous, plan: planId },
      });
      creditsGranted = creditsAdded;
    }

    await logAdminAction(
      { id: admin.id, email: admin.email },
      "change_plan",
      { userId: user.id, email: user.email },
      `${previous} → ${planId}` + (creditsGranted > 0 ? ` (credits +${creditsGranted})` : "")
    ).catch((e) => console.error("audit log failed:", e));
    return json({ ok: true, email: user.email, previous, plan: planId, creditsGranted });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    if (message === "Forbidden") return error("Forbidden", 403);
    console.error("admin plan error:", e);
    return error("Something went wrong", 500);
  }
}
