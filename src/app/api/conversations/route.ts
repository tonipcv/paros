import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json, handleRouteError } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const conversations = await prisma.conversation.findMany({
      where: { workspaceId: ws.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, model: true, updatedAt: true, encrypted: true, titleIv: true },
    });
    return json({ conversations });
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
    let character = null;
    if (body.characterId) {
      character = await prisma.character.findFirst({
        where: { id: String(body.characterId), workspaceId: ws.id },
      });
      if (!character) return error("Character not found", 404);
    }
    const encrypted = Boolean(body.encrypted);
    const conversation = await prisma.conversation.create({
      data: {
        workspaceId: ws.id,
        model: (character?.model || body.model || "") as string,
        title: encrypted && body.titleCt ? String(body.titleCt) : character ? character.name : "New chat",
        titleIv: encrypted && body.titleIv ? String(body.titleIv) : null,
        encrypted,
        characterId: character?.id,
        ephemeral: Boolean(body.ephemeral) || ws.privacyMode,
        temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
        systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt : null,
      },
    });
    if (character?.greeting) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: character.greeting,
          model: character.model || null,
        },
      });
    }
    return json({ conversation });
  } catch (e) {
    return handleRouteError(e);
  }
}
