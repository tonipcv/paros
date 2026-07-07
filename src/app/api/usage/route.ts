import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json, handleRouteError } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const [events, chatCount, imageCount, convoCount] = await Promise.all([
      prisma.usageEvent.findMany({
        where: { workspaceId: ws.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.usageEvent.count({ where: { workspaceId: ws.id, kind: "chat" } }),
      prisma.usageEvent.count({ where: { workspaceId: ws.id, kind: "image" } }),
      prisma.conversation.count({ where: { workspaceId: ws.id } }),
    ]);
    const creditsUsed = events.reduce((sum, e) => sum + e.credits, 0);
    return json({
      credits: ws.credits,
      plan: ws.plan,
      creditsUsed,
      chatCount,
      imageCount,
      convoCount,
      events: events.slice(0, 20),
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
