import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleRouteError, json } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin("ADMIN");
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        workspace: { select: { plan: true, credits: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return json({ users });
  } catch (e) {
    return handleRouteError(e);
  }
}
