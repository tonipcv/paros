import { prisma } from "./prisma";
import { hashApiKey } from "./auth";
import { rateLimit } from "./rate-limit";

export type ApiAuthResult =
  | { ok: true; workspace: { id: string; credits: number; plan: string }; keyId: string }
  | { ok: false; status: number; message: string; retryAfter?: number };

export async function authenticateApiKey(request: Request): Promise<ApiAuthResult> {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("nb-")) return { ok: false, status: 401, message: "Invalid API key" };

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(token) },
    include: { workspace: true },
  });
  if (!key) return { ok: false, status: 401, message: "Invalid API key" };

  const limit = rateLimit(`key:${key.id}`);
  if (!limit.ok) {
    return { ok: false, status: 429, message: "Rate limit exceeded", retryAfter: limit.retryAfter };
  }

  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return {
    ok: true,
    keyId: key.id,
    workspace: { id: key.workspace.id, credits: key.workspace.credits, plan: key.workspace.plan },
  };
}
