import { logAdminAction } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin("SUPER_ADMIN");
    if (!admin) return error("Authentication required", 401);
    const { id } = await params;
    const provider = await prisma.modelProvider.findUnique({ where: { id }, select: { id: true, slug: true } });
    if (!provider) return error("Provider not found", 404);
    const body = await request.json().catch(() => ({}));
    const data: { enabled?: boolean; priority?: number; zeroRetention?: boolean } = {};
    if ("enabled" in body) data.enabled = Boolean(body.enabled);
    if ("zeroRetention" in body) data.zeroRetention = Boolean(body.zeroRetention);
    if ("priority" in body) {
      const value = Number(body.priority);
      if (!Number.isInteger(value) || value < 0 || value > 100_000) return error("Invalid priority");
      data.priority = value;
    }
    if (!Object.keys(data).length) return error("No supported fields supplied");
    const updated = await prisma.modelProvider.update({ where: { id }, data });
    await logAdminAction({ id: admin.id, email: admin.email }, "update_model_provider", undefined, `${provider.slug}: ${Object.keys(data).join(", ")}`);
    return json({ ok: true, provider: updated });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed";
    if (message === "Forbidden") return error("Forbidden", 403);
    if (message === "Authentication required") return error(message, 401);
    console.error("model provider update failed:", cause);
    return error("Something went wrong", 500);
  }
}
