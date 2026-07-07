import { requireUser, generateApiKey } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json, handleRouteError } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const keys = await prisma.apiKey.findMany({
      where: { workspaceId: ws.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
    });
    return json({ keys });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "API Key").slice(0, 40);
    const { key, prefix, hash } = generateApiKey();
    const record = await prisma.apiKey.create({
      data: { workspaceId: ws.id, name, keyHash: hash, keyPrefix: prefix },
    });
    return json({ id: record.id, name: record.name, key });
  } catch (e) {
    return handleRouteError(e);
  }
}
