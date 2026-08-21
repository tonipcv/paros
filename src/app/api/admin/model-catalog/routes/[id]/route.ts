import type { RouteStatus } from "@prisma/client";
import { logAdminAction } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const STATUSES = ["ACTIVE", "DEGRADED", "OFFLINE", "DISABLED"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin("SUPER_ADMIN");
    if (!admin) return error("Authentication required", 401);
    const { id } = await params;
    const route = await prisma.modelRoute.findUnique({ where: { id }, include: { model: { select: { publicId: true } }, provider: { select: { slug: true } } } });
    if (!route) return error("Route not found", 404);
    const body = await request.json().catch(() => ({}));
    const data: { status?: RouteStatus; priority?: number; weight?: number } = {};
    if ("status" in body) {
      const value = String(body.status).toUpperCase();
      if (!STATUSES.includes(value as RouteStatus)) return error("Invalid route status");
      data.status = value as RouteStatus;
    }
    for (const key of ["priority", "weight"] as const) if (key in body) {
      const value = Number(body[key]);
      if (!Number.isInteger(value) || value < 0 || value > 100_000) return error(`Invalid ${key}`);
      data[key] = value;
    }
    if (!Object.keys(data).length) return error("No supported fields supplied");
    const updated = await prisma.modelRoute.update({ where: { id }, data });
    await logAdminAction({ id: admin.id, email: admin.email }, "update_model_route", undefined, `${route.model.publicId} via ${route.provider.slug}: ${Object.keys(data).join(", ")}`);
    return json({ ok: true, route: updated });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed";
    if (message === "Forbidden") return error("Forbidden", 403);
    if (message === "Authentication required") return error(message, 401);
    console.error("model route update failed:", cause);
    return error("Something went wrong", 500);
  }
}
