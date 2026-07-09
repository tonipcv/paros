import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { runAllChecks, persistAndDetectChanges } from "@/lib/monitor";
import { logAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

export async function POST() {
  try {
    const admin = await requireAdmin("ADMIN");
    if (!admin) return error("Authentication required", 401);
    const checks = await runAllChecks();
    const changed = await persistAndDetectChanges(checks);
    await logAdminAction(
      { id: admin.id, email: admin.email },
      "health_check",
      undefined,
      `${checks.length} checks, ${changed.length} changed`
    ).catch((e) => console.error("audit log failed:", e));
    return json({ checks: checks.length, changed: changed.length, summary: changed.map((c) => `${c.name}: ${c.status}`) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    return error(message, 500);
  }
}
