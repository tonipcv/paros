import { prisma } from "./prisma";
import { hashPassword } from "./auth";

export async function createUserWithWorkspace(data: {
  name: string;
  email: string;
  password: string;
}) {
  const email = data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already registered");

  const user = await prisma.user.create({
    data: {
      email,
      name: data.name || email.split("@")[0],
      password: hashPassword(data.password),
      workspace: {
        create: {
          name: `${data.name || email.split("@")[0]}'s Workspace`,
          plan: "FREE",
          credits: 500,
        },
      },
    },
    include: { workspace: true },
  });
  return user;
}

export async function getWorkspaceForUser(userId: string) {
  return prisma.workspace.findUnique({ where: { userId } });
}

export async function findOrCreateOAuthUser(data: { name: string; email: string }) {
  const email = data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email,
      name: data.name || email.split("@")[0],
      emailVerified: new Date(),
      workspace: {
        create: {
          name: `${data.name || email.split("@")[0]}'s Workspace`,
          plan: "FREE",
          credits: 500,
        },
      },
    },
  });
}

export async function chargeCredits(workspaceId: string, kind: string, model: string, credits: number) {
  await prisma.$transaction([
    prisma.workspace.update({
      where: { id: workspaceId },
      data: { credits: { decrement: credits } },
    }),
    prisma.usageEvent.create({
      data: { workspaceId, kind, model, credits },
    }),
  ]);
}
