import type { CatalogStatus, ModelModality, Prisma, PricingUnit, RouteStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { CHAT_MODELS, IMAGE_MODELS } from "./models";

export const CATALOG_PAGE_MAX = 200;

export type CatalogFilters = {
  modality?: ModelModality;
  status?: CatalogStatus;
  capability?: string;
  provider?: string;
  search?: string;
  cursor?: string;
  limit?: number;
};

export type ResolvedModel = {
  id: string;
  name: string;
  modality: ModelModality;
  credits: number;
  contextTokens?: number;
  maxOutputTokens?: number;
  capabilities: Record<string, boolean>;
  route: { id?: string; provider: string; providerModelId: string; baseUrl?: string | null };
  routes: Array<{ id?: string; provider: string; providerModelId: string; baseUrl?: string | null }>;
};

const include = {
  capabilities: true,
  aliases: true,
  prices: { where: { expiresAt: null }, orderBy: { effectiveAt: "desc" as const } },
  routes: {
    where: { status: { in: ["ACTIVE", "DEGRADED"] as RouteStatus[] }, provider: { enabled: true } },
    include: { provider: true },
    orderBy: [{ priority: "asc" as const }, { errorRate: "asc" as const }, { latencyMs: "asc" as const }],
  },
} satisfies Prisma.CatalogModelInclude;

function parseContext(value: string): number | undefined {
  const match = value.trim().toUpperCase().match(/([\d.]+)\s*([KM])?/);
  if (!match) return undefined;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return undefined;
  return Math.round(number * (match[2] === "M" ? 1_000_000 : match[2] === "K" ? 1_000 : 1));
}

function capabilityWhere(capability?: string): Prisma.ModelCapabilityWhereInput | undefined {
  const allowed = new Set([
    "vision", "videoInput", "audioInput", "reasoning", "reasoningEffort", "functionCalling",
    "structuredOutput", "logProbs", "multipleImages", "webSearch", "uncensored", "coding",
    "streaming", "tee", "e2ee", "imageGeneration", "imageEditing", "textToVideo", "imageToVideo",
  ]);
  return capability && allowed.has(capability) ? { [capability]: true } : undefined;
}

function serialize(model: Prisma.CatalogModelGetPayload<{ include: typeof include }>) {
  return {
    id: model.publicId,
    object: "model" as const,
    created: Math.floor(model.createdAt.getTime() / 1000),
    owned_by: model.author || model.routes[0]?.provider.name || "krx",
    name: model.name,
    description: model.description,
    type: model.modality.toLowerCase(),
    status: model.status.toLowerCase(),
    context_window: model.contextTokens,
    max_output_tokens: model.maxOutputTokens,
    credits_per_request: model.credits,
    capabilities: model.capabilities ? Object.fromEntries(
      Object.entries(model.capabilities).filter(([key, value]) => !["id", "modelId", "createdAt", "updatedAt"].includes(key) && typeof value === "boolean")
    ) : {},
    aliases: model.aliases.map((item) => item.alias),
    providers: model.routes.map((route) => ({
      id: route.provider.slug,
      model_id: route.providerModelId,
      status: route.status.toLowerCase(),
      latency_ms: route.latencyMs,
    })),
    pricing: model.prices.map((price) => ({ unit: price.unit.toLowerCase(), usd: price.usd.toString() })),
  };
}

function staticModels(modality?: ModelModality) {
  const chat = CHAT_MODELS.map((model) => ({
    id: model.id,
    object: "model" as const,
    created: 0,
    owned_by: model.provider,
    name: model.name,
    description: model.description,
    type: "text",
    status: "active",
    context_window: parseContext(model.context),
    max_output_tokens: model.maxOutput,
    credits_per_request: model.credits,
    capabilities: { vision: Boolean(model.vision), reasoning: Boolean(model.reasoning), uncensored: Boolean(model.uncensored), streaming: true },
    aliases: [],
    providers: [{ id: "openrouter", model_id: model.id, status: "active", latency_ms: null }],
    pricing: [],
  }));
  const images = IMAGE_MODELS.map((model) => ({
    id: model.id,
    object: "model" as const,
    created: 0,
    owned_by: model.provider || "openrouter",
    name: model.name,
    description: "",
    type: "image",
    status: "active",
    context_window: undefined,
    max_output_tokens: undefined,
    credits_per_request: model.credits,
    capabilities: { imageGeneration: true, uncensored: Boolean(model.uncensored) },
    aliases: [],
    providers: [{ id: model.provider || "openrouter", model_id: model.id, status: "active", latency_ms: null }],
    pricing: [],
  }));
  return modality === "TEXT" ? chat : modality === "IMAGE" ? images : modality ? [] : [...chat, ...images];
}

export async function listCatalogModels(filters: CatalogFilters = {}) {
  const limit = Math.max(1, Math.min(CATALOG_PAGE_MAX, filters.limit || 100));
  try {
    const capability = capabilityWhere(filters.capability);
    const rows = await prisma.catalogModel.findMany({
      where: {
        modality: filters.modality,
        status: filters.status || "ACTIVE",
        ...(filters.search ? { OR: [
          { publicId: { contains: filters.search, mode: "insensitive" } },
          { name: { contains: filters.search, mode: "insensitive" } },
          { author: { contains: filters.search, mode: "insensitive" } },
        ] } : {}),
        ...(capability ? { capabilities: { is: capability } } : {}),
        routes: { some: {
          status: { in: ["ACTIVE", "DEGRADED"] },
          provider: { enabled: true, ...(filters.provider ? { slug: filters.provider } : {}) },
        } },
      },
      include,
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { publicId: "asc" }],
      ...(filters.cursor ? { cursor: { publicId: filters.cursor }, skip: 1 } : {}),
      take: limit + 1,
    });
    if (rows.length === 0 && !filters.cursor) {
      const fallback = staticModels(filters.modality).slice(0, limit);
      return { data: fallback, nextCursor: null, source: "static" as const };
    }
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { data: page.map(serialize), nextCursor: hasMore ? page[page.length - 1]?.publicId || null : null, source: "database" as const };
  } catch (error) {
    console.error("catalog query failed; using static fallback:", error);
    const fallback = staticModels(filters.modality).slice(0, limit);
    return { data: fallback, nextCursor: null, source: "static" as const };
  }
}

export async function resolveCatalogModel(id: string, modality: ModelModality): Promise<ResolvedModel | null> {
  try {
    const model = await prisma.catalogModel.findFirst({
      where: {
        modality,
        status: { in: ["ACTIVE", "DEGRADED"] },
        OR: [{ publicId: id }, { aliases: { some: { alias: id } } }],
      },
      include,
    });
    const route = model?.routes[0];
    if (model && !route) return null;
    if (model && route) {
      const capabilities = model.capabilities ? Object.fromEntries(
        Object.entries(model.capabilities).filter(([, value]) => typeof value === "boolean")
      ) as Record<string, boolean> : {};
      return {
        id: model.publicId,
        name: model.name,
        modality: model.modality,
        credits: model.credits,
        contextTokens: model.contextTokens ?? undefined,
        maxOutputTokens: model.maxOutputTokens ?? undefined,
        capabilities,
        route: { id: route.id, provider: route.provider.slug, providerModelId: route.providerModelId, baseUrl: route.provider.baseUrl },
        routes: model.routes.map((candidate) => ({ id: candidate.id, provider: candidate.provider.slug, providerModelId: candidate.providerModelId, baseUrl: candidate.provider.baseUrl })),
      };
    }
  } catch (error) {
    console.error("catalog resolution failed; using static fallback:", error);
  }

  if (modality === "TEXT") {
    const model = CHAT_MODELS.find((item) => item.id === id);
    return model ? {
      id: model.id, name: model.name, modality, credits: model.credits,
      contextTokens: parseContext(model.context), maxOutputTokens: model.maxOutput,
      capabilities: { vision: Boolean(model.vision), reasoning: Boolean(model.reasoning), uncensored: Boolean(model.uncensored), streaming: true },
      route: { provider: "openrouter", providerModelId: model.id },
      routes: [{ provider: "openrouter", providerModelId: model.id }],
    } : null;
  }
  if (modality === "IMAGE") {
    const model = IMAGE_MODELS.find((item) => item.id === id);
    return model ? {
      id: model.id, name: model.name, modality, credits: model.credits,
      capabilities: { imageGeneration: true, uncensored: Boolean(model.uncensored) },
      route: { provider: model.provider || "openrouter", providerModelId: model.id },
      routes: [{ provider: model.provider || "openrouter", providerModelId: model.id }],
    } : null;
  }
  return null;
}

export async function recordModelRouteOutcome(routeId: string | undefined, success: boolean, latencyMs: number, error?: string) {
  if (!routeId) return;
  try {
    const current = await prisma.modelRoute.findUnique({ where: { id: routeId }, select: { errorRate: true } });
    if (!current) return;
    const errorRate = Math.max(0, Math.min(1, current.errorRate * 0.9 + (success ? 0 : 0.1)));
    await prisma.modelRoute.update({
      where: { id: routeId },
      data: {
        latencyMs: Math.max(0, Math.round(latencyMs)), errorRate, lastCheckedAt: new Date(),
        lastError: success ? null : (error || "Inference request failed").slice(0, 2000),
        status: errorRate >= 0.5 ? "DEGRADED" : "ACTIVE",
      },
    });
  } catch (catalogError) {
    console.error("failed to record model route outcome:", catalogError);
  }
}

export type CatalogImportModel = {
  publicId: string;
  providerModelId: string;
  name: string;
  description?: string;
  author?: string;
  modality: ModelModality;
  contextTokens?: number;
  maxOutputTokens?: number;
  credits: number;
  capabilities: Record<string, boolean>;
  prices?: Array<{ unit: PricingUnit; usd: string }>;
  metadata?: Prisma.InputJsonValue;
};
