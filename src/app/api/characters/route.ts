import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json, handleRouteError } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const characters = await prisma.character.findMany({
      where: { workspaceId: ws.id },
      orderBy: { createdAt: "desc" },
    });
    return json({ characters });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const body = await request.json();
    const name = String(body.name || "").trim();
    const systemPrompt = String(body.systemPrompt || "").trim();
    if (!name) return error("Name required");
    if (!systemPrompt) return error("Personality (system prompt) required");
    const character = await prisma.character.create({
      data: {
        workspaceId: ws.id,
        name: name.slice(0, 60),
        tagline: String(body.tagline || "").slice(0, 120),
        emoji: "",
        systemPrompt: systemPrompt.slice(0, 4000),
        greeting: String(body.greeting || "").slice(0, 1000),
        model: String(body.model || ""),
      },
    });
    return json({ character });
  } catch (e) {
    return handleRouteError(e);
  }
}
