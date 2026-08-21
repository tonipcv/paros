import type { CreditGrantSource, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { COGS_MICROS_PER_CREDIT } from "./unit-economics";

const DEFAULT_GRANT_LIFETIME_DAYS = 62;

export function allocateGrantCredits(
  grants: Array<{ id: string; creditsRemaining: number; cogsRemainingMicros: bigint }>,
  requestedCredits: number,
) {
  let remaining = Math.max(0, Math.floor(requestedCredits));
  const allocations: Array<{ grantId: string; credits: number }> = [];
  for (const grant of grants) {
    if (remaining <= 0) break;
    const budgetCredits = Number(grant.cogsRemainingMicros / COGS_MICROS_PER_CREDIT);
    const credits = Math.min(remaining, grant.creditsRemaining, budgetCredits);
    if (credits <= 0) continue;
    allocations.push({ grantId: grant.id, credits });
    remaining -= credits;
  }
  return { allocations, legacyCredits: remaining };
}

export async function grantCredits(input: {
  workspaceId: string;
  source: CreditGrantSource;
  sourceRef?: string;
  credits: number;
  monthlyAllowance: number;
  expiresAt?: Date;
  metadata?: Prisma.InputJsonValue;
}) {
  if (!Number.isInteger(input.credits) || input.credits <= 0) throw new Error("credits must be a positive integer");
  if (!Number.isInteger(input.monthlyAllowance) || input.monthlyAllowance <= 0) throw new Error("monthlyAllowance must be a positive integer");
  const expiresAt = input.expiresAt || new Date(Date.now() + DEFAULT_GRANT_LIFETIME_DAYS * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    if (input.sourceRef) {
      const existing = await tx.creditGrant.findUnique({ where: { sourceRef: input.sourceRef } });
      if (existing) return { grant: existing, creditsAdded: 0, idempotent: true };
    }
    const workspace = await tx.workspace.findUnique({ where: { id: input.workspaceId }, select: { credits: true } });
    if (!workspace) throw new Error("Workspace not found");

    // Current allowance + one full cycle of rollover. Existing scalar credits are
    // included so legacy balances cannot bypass the cap during migration.
    const balanceCap = input.monthlyAllowance * 2;
    const creditsAdded = Math.min(input.credits, Math.max(0, balanceCap - workspace.credits));
    const cogsBudgetMicros = BigInt(creditsAdded) * COGS_MICROS_PER_CREDIT;
    const grant = await tx.creditGrant.create({
      data: {
        workspaceId: input.workspaceId,
        source: input.source,
        sourceRef: input.sourceRef,
        creditsGranted: creditsAdded,
        creditsRemaining: creditsAdded,
        cogsBudgetMicros,
        cogsRemainingMicros: cogsBudgetMicros,
        expiresAt,
        metadata: input.metadata || {},
      },
    });
    if (creditsAdded > 0) {
      await tx.workspace.update({ where: { id: input.workspaceId }, data: { credits: { increment: creditsAdded } } });
    }
    return { grant, creditsAdded, idempotent: false };
  });
}

export async function expireCreditGrants(now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const grants = await tx.creditGrant.findMany({
      where: { expiredAt: null, expiresAt: { lte: now } },
      orderBy: [{ workspaceId: "asc" }, { expiresAt: "asc" }],
      select: { id: true, workspaceId: true, creditsRemaining: true },
    });
    let creditsExpired = 0;
    for (const grant of grants) {
      const workspace = await tx.workspace.findUnique({ where: { id: grant.workspaceId }, select: { credits: true } });
      const amount = Math.min(workspace?.credits || 0, grant.creditsRemaining);
      if (amount > 0) {
        await tx.workspace.update({ where: { id: grant.workspaceId }, data: { credits: { decrement: amount } } });
      }
      await tx.creditGrant.update({
        where: { id: grant.id },
        data: { creditsRemaining: 0, cogsRemainingMicros: 0n, expiredAt: now },
      });
      creditsExpired += amount;
    }
    return { grantsExpired: grants.length, creditsExpired };
  }, { isolationLevel: "Serializable" });
}

export async function resetFreeMonthlyGrant(workspaceId: string, credits: number, period: string, now = new Date()) {
  const sourceRef = `free:${workspaceId}:${period}`;
  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditGrant.findUnique({ where: { sourceRef } });
    if (existing) return { reset: false, grant: existing };
    const workspace = await tx.workspace.findFirst({ where: { id: workspaceId, plan: "FREE" }, select: { id: true } });
    if (!workspace) return { reset: false, grant: null };
    await tx.creditGrant.updateMany({
      where: { workspaceId, expiredAt: null },
      data: { creditsRemaining: 0, cogsRemainingMicros: 0n, expiredAt: now },
    });
    await tx.workspace.update({ where: { id: workspaceId }, data: { credits: 0 } });
    const budget = BigInt(credits) * COGS_MICROS_PER_CREDIT;
    const grant = await tx.creditGrant.create({
      data: {
        workspaceId, source: "FREE", sourceRef, creditsGranted: credits, creditsRemaining: credits,
        cogsBudgetMicros: budget, cogsRemainingMicros: budget,
        expiresAt: new Date(now.getTime() + 32 * 24 * 60 * 60 * 1000), metadata: { period },
      },
    });
    await tx.workspace.update({ where: { id: workspaceId }, data: { credits } });
    return { reset: true, grant };
  }, { isolationLevel: "Serializable" });
}
