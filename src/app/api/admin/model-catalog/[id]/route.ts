import type { CatalogStatus, ModelModality, Prisma } from "@prisma/client";
import { logAdminAction } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const STATUSES = ["DRAFT", "ACTIVE", "DEGRADED", "OFFLINE", "DEPRECATED"] as const;
const MODALITIES = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "EMBEDDING", "MUSIC", "UPSCALE", "INPAINT", "ASR", "TTS"] as const;

function integer(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin("SUPER_ADMIN");
    if (!admin) return error("Authentication required", 401);
    const { id } = await params;
    const existing = await prisma.catalogModel.findUnique({ where: { id }, select: { id: true, publicId: true } });
    if (!existing) return error("Model not found", 404);
    const body = await request.json().catch(() => ({}));
    const data: Prisma.CatalogModelUpdateInput = {};
    if ("name" in body) {
      const value = String(body.name || "").trim();
      if (!value || value.length > 160) return error("Name must be between 1 and 160 characters");
      data.name = value;
    }
    if ("description" in body) data.description = String(body.description || "").slice(0, 10_000);
    if ("author" in body) data.author = String(body.author || "").trim().slice(0, 120);
    if ("status" in body) {
      const value = String(body.status).toUpperCase();
      if (!STATUSES.includes(value as CatalogStatus)) return error("Invalid model status");
      data.status = value as CatalogStatus;
      data.deprecatedAt = value === "DEPRECATED" ? new Date() : null;
    }
    if ("modality" in body) {
      const value = String(body.modality).toUpperCase();
      if (!MODALITIES.includes(value as ModelModality)) return error("Invalid model modality");
      data.modality = value as ModelModality;
    }
    for (const [key, min, max] of [["credits", 0, 1_000_000], ["sortOrder", -1_000_000, 1_000_000]] as const) {
      if (key in body) {
        const value = integer(body[key], min, max);
        if (value === null) return error(`Invalid ${key}`);
        data[key] = value;
      }
    }
    for (const key of ["contextTokens", "maxOutputTokens"] as const) {
      if (key in body) {
        if (body[key] === null || body[key] === "") data[key] = null;
        else {
          const value = integer(body[key], 1, 10_000_000);
          if (value === null) return error(`Invalid ${key}`);
          data[key] = value;
        }
      }
    }
    if ("featured" in body) data.featured = Boolean(body.featured);
    if (!Object.keys(data).length) return error("No supported fields supplied");
    const model = await prisma.catalogModel.update({ where: { id }, data });
    await logAdminAction({ id: admin.id, email: admin.email }, "update_model", undefined, `${existing.publicId}: ${Object.keys(data).join(", ")}`);
    return json({ ok: true, model });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed";
    if (message === "Forbidden") return error("Forbidden", 403);
    if (message === "Authentication required") return error(message, 401);
    console.error("model catalog update failed:", cause);
    return error("Something went wrong", 500);
  }
}
