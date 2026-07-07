import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";

export async function createGuestUser() {
  const email = `guest_${randomUUID()}@guest.local`;
  return prisma.user.create({
    data: {
      email,
      name: "Guest",
      role: "USER",
      workspace: { create: { name: "Guest workspace", plan: "FREE", credits: 5 } },
    },
    include: { workspace: true },
  });
}

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
          credits: 10,
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
          credits: 10,
        },
      },
    },
  });
}

export async function chargeCredits(workspaceId: string, kind: string, model: string, credits: number) {
  const updated = await prisma.workspace.updateMany({
    where: { id: workspaceId, credits: { gte: credits } },
    data: { credits: { decrement: credits } },
  });
  if (updated.count === 0) throw new Error("Insufficient credits");
  await prisma.usageEvent.create({
    data: { workspaceId, kind, model, credits },
  });
}

// Atomically reserve (debit) credits without logging usage. Returns false if
// the workspace does not have enough credits. Pair with refundCredits/recordUsage
// so a failed operation never leaves the user charged for nothing.
export async function reserveCredits(workspaceId: string, credits: number): Promise<boolean> {
  const updated = await prisma.workspace.updateMany({
    where: { id: workspaceId, credits: { gte: credits } },
    data: { credits: { decrement: credits } },
  });
  return updated.count > 0;
}

export async function refundCredits(workspaceId: string, credits: number) {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { credits: { increment: credits } },
  });
}

export async function recordUsage(workspaceId: string, kind: string, model: string, credits: number) {
  await prisma.usageEvent.create({ data: { workspaceId, kind, model, credits } });
}
