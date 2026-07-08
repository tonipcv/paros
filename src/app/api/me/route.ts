import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { error, json } from "@/lib/http";

export async function GET() {
  const user = await currentUser();
  if (!user) return error("Not authenticated", 401);
  const workspace = await prisma.workspace.findUnique({ where: { userId: user.id } });
  return json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: Boolean(user.emailVerified),
    },
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          plan: workspace.plan,
          credits: workspace.credits,
          onboardingCompleted: workspace.onboardingCompleted,
          privacyMode: workspace.privacyMode,
          encEnabled: workspace.encEnabled,
          encSalt: workspace.encSalt,
          encCheckIv: workspace.encCheckIv,
          encCheckCt: workspace.encCheckCt,
        }
      : null,
  });
}
