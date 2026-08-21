import { requireAdmin } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { CatalogStatus, ModelModality, Prisma } from "@prisma/client";

export const runtime = "nodejs";

const MODALITIES = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "EMBEDDING", "MUSIC", "UPSCALE", "INPAINT", "ASR", "TTS"] as const;
const STATUSES = ["DRAFT", "ACTIVE", "DEGRADED", "OFFLINE", "DEPRECATED"] as const;

export async function GET(request: Request) {
  try {
    await requireAdmin("ADMIN");
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const modality = url.searchParams.get("modality")?.toUpperCase();
    const status = url.searchParams.get("status")?.toUpperCase();
    const provider = (url.searchParams.get("provider") || "").trim();
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(10, Number.parseInt(url.searchParams.get("limit") || "30", 10) || 30));
    const where: Prisma.CatalogModelWhereInput = {
      ...(search ? { OR: [
        { publicId: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { author: { contains: search, mode: "insensitive" } },
      ] } : {}),
      ...(MODALITIES.includes(modality as ModelModality) ? { modality: modality as ModelModality } : {}),
      ...(STATUSES.includes(status as CatalogStatus) ? { status: status as CatalogStatus } : {}),
      ...(provider ? { routes: { some: { provider: { slug: provider } } } } : {}),
    };
    const [total, filteredTotal, models, byModality, byStatus, providers, recentSyncs, unhealthyRoutes] = await Promise.all([
      prisma.catalogModel.count(),
      prisma.catalogModel.count({ where }),
      prisma.catalogModel.findMany({
        where,
        orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          capabilities: true,
          aliases: { orderBy: { alias: "asc" } },
          routes: {
            orderBy: [{ priority: "asc" }, { provider: { priority: "asc" } }],
            include: { provider: { select: { id: true, slug: true, name: true, enabled: true } }, prices: { where: { expiresAt: null }, orderBy: { unit: "asc" } } },
          },
        },
      }),
      prisma.catalogModel.groupBy({ by: ["modality"], _count: { _all: true }, orderBy: { modality: "asc" } }),
      prisma.catalogModel.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
      prisma.modelProvider.findMany({
        orderBy: { priority: "asc" },
        select: { id: true, slug: true, name: true, kind: true, enabled: true, priority: true, zeroRetention: true, baseUrl: true, lastSyncedAt: true, _count: { select: { routes: true } } },
      }),
      prisma.catalogSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 20, include: { provider: { select: { slug: true, name: true } } } }),
      prisma.modelRoute.count({ where: { status: { in: ["DEGRADED", "OFFLINE"] } } }),
    ]);
    return json({ total, filteredTotal, page, limit, pages: Math.max(1, Math.ceil(filteredTotal / limit)), models, byModality, byStatus, providers, recentSyncs, unhealthyRoutes });
  } catch (error) {
    return handleRouteError(error);
  }
}
