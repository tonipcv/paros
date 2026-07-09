import { requireAdmin } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { getRecentActions } from "@/lib/admin-audit";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin("ADMIN");
    const actions = await getRecentActions(50);
    return json({ actions });
  } catch (e) {
    return handleRouteError(e);
  }
}
