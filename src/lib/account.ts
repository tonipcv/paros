import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { allocateGrantCredits } from "./credit-grants";

export async function createGuestUser() {
  const email = `guest_${randomUUID()}@guest.local`;
  return prisma.user.create({
    data: { email, name: "Guest", role: "USER", workspace: { create: { name: "Guest workspace", plan: "FREE", credits: 5 } } },
    include: { workspace: true },
  });
}

export async function createUserWithWorkspace(data: { name: string; email: string; password: string }) {
  const email = data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already registered");
  const user = await prisma.user.create({
    data: {
      email, name: data.name || email.split("@")[0], password: hashPassword(data.password),
      workspace: { create: { name: `${data.name || email.split("@")[0]}'s Workspace`, plan: "FREE", credits: 10 } },
    },
    include: { workspace: true },
  });
  return user;
}

export async function getWorkspaceForUser(userId: string) { return prisma.workspace.findUnique({ where: { userId } }); }

export async function findOrCreateOAuthUser(data: { name: string; email: string }): Promise<{ user: Awaited<ReturnType<typeof prisma.user.create>>; created: boolean }> {
  const email = data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { user: existing, created: false };
  const user = await prisma.user.create({
    data: { email, name: data.name || email.split("@")[0], emailVerified: new Date(), workspace: { create: { name: `${data.name || email.split("@")[0]}'s Workspace`, plan: "FREE", credits: 10 } } },
  });
  return { user, created: true };
}

export async function chargeCredits(workspaceId: string, kind: string, model: string, credits: number, usage?: { tokens?: number; cost?: number; generationId?: string }) {
  if (!(await reserveCredits(workspaceId, credits))) throw new Error("Insufficient credits");
  await prisma.usageEvent.create({ data: { workspaceId, kind, model, credits, tokens: usage?.tokens ?? 0, costUsd: usage?.cost ? BigInt(Math.round(usage.cost * 1_000_000)) : 0n, generationId: usage?.generationId ?? null, settlement: "SETTLED" } });
}

export async function reserveCredits(workspaceId: string, credits: number): Promise<boolean> {
  if (!Number.isInteger(credits) || credits <= 0) return false;
  try {
    return await prisma.$transaction(async (tx) => {
      const charged = await tx.workspace.updateMany({
        where: { id: workspaceId, providerAccess: true, credits: { gte: credits } },
        data: { credits: { decrement: credits } },
      });
      if (!charged.count) return false;

      const now = new Date();
      const grants = await tx.creditGrant.findMany({
        where: { workspaceId, creditsRemaining: { gt: 0 }, expiredAt: null, grantedAt: { lte: now }, expiresAt: { gt: now } },
        orderBy: [{ expiresAt: "asc" }, { grantedAt: "asc" }],
        select: { id: true, creditsRemaining: true, cogsRemainingMicros: true },
      });
      const { allocations } = allocateGrantCredits(grants, credits);
      for (const allocation of allocations) {
        const budget = BigInt(allocation.credits) * 15_000n;
        const updated = await tx.creditGrant.updateMany({
          where: { id: allocation.grantId, creditsRemaining: { gte: allocation.credits }, cogsRemainingMicros: { gte: budget } },
          data: { creditsRemaining: { decrement: allocation.credits }, cogsRemainingMicros: { decrement: budget } },
        });
        if (!updated.count) throw new Error("Concurrent credit grant update");
      }
      await tx.creditDebit.create({ data: { workspaceId, credits, allocations } });
      return true;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    console.error("credit reservation failed:", error);
    return false;
  }
}

// Atomic additional charge on top of an existing reservation (no new grant allocation).
export async function chargeCreditsAdditional(workspaceId: string, credits: number): Promise<boolean> {
  if (!Number.isInteger(credits) || credits <= 0) return true;
  try {
    const result = await prisma.workspace.updateMany({
      where: { id: workspaceId, providerAccess: true, credits: { gte: credits } },
      data: { credits: { decrement: credits } },
    });
    return result.count > 0;
  } catch (error) {
    console.error("additional credit charge failed:", error);
    return false;
  }
}

export async function refundCredits(workspaceId: string, credits: number) {
  if (!Number.isInteger(credits) || credits <= 0) return;
  await prisma.$transaction(async (tx) => {
    const debit = await tx.creditDebit.findFirst({
      where: { workspaceId, credits, refundedAt: null },
      orderBy: { createdAt: "desc" },
    });
    await tx.workspace.update({ where: { id: workspaceId }, data: { credits: { increment: credits } } });
    if (!debit) return;
    const allocations = Array.isArray(debit.allocations) ? debit.allocations : [];
    for (const raw of allocations) {
      if (!raw || typeof raw !== "object") continue;
      const grantId = (raw as { grantId?: unknown }).grantId;
      const amount = (raw as { credits?: unknown }).credits;
      if (typeof grantId !== "string" || typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) continue;
      await tx.creditGrant.updateMany({
        where: { id: grantId, expiredAt: null, expiresAt: { gt: new Date() } },
        data: { creditsRemaining: { increment: amount }, cogsRemainingMicros: { increment: BigInt(amount) * 15_000n } },
      });
    }
    await tx.creditDebit.update({ where: { id: debit.id }, data: { refundedAt: new Date() } });
  }, { isolationLevel: "Serializable" });
}

// ── Concurrency: lease table with TTL ──
const LEASE_TTL_MINUTES = 3;

export async function acquireConcurrencySlot(wsId: string, maxSlots: number): Promise<{ slot: number; requestId: string } | null> {
  const requestId = randomUUID();
  const expiresAt = new Date(Date.now() + LEASE_TTL_MINUTES * 60_000);
  // Try each slot: take it if free or expired
  for (let slot = 0; slot < maxSlots; slot++) {
    try {
      await prisma.$executeRaw`
        INSERT INTO "concurrency_leases" ("id", "workspaceId", "slot", "requestId", "expiresAt")
        VALUES (${randomUUID()}, ${wsId}, ${slot}, ${requestId}, ${expiresAt})
        ON CONFLICT ("workspaceId", "slot")
        DO UPDATE SET "requestId" = EXCLUDED."requestId", "expiresAt" = EXCLUDED."expiresAt"
        WHERE "concurrency_leases"."expiresAt" < NOW()
      `;
      // Verify we actually got it (ON CONFLICT DO UPDATE only fires when condition matches)
      const lease = await prisma.concurrencyLease.findFirst({ where: { workspaceId: wsId, slot, requestId } });
      if (lease) return { slot, requestId };
    } catch { continue; }
  }
  return null;
}

export async function releaseConcurrencySlot(wsId: string, slot: number, requestId: string) {
  await prisma.concurrencyLease.deleteMany({ where: { workspaceId: wsId, slot, requestId } });
}

// ── Daily spend ──

export async function getDailySpent(wsId: string): Promise<bigint> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const row = await prisma.workspaceDailySpend.findUnique({ where: { workspaceId_date: { workspaceId: wsId, date: today } } });
  return row?.spentMicros ?? 0n;
}

export async function reserveDailySpend(wsId: string, estimatedMicros: bigint, limitMicros: bigint): Promise<boolean> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  await prisma.workspaceDailySpend.upsert({ where: { workspaceId_date: { workspaceId: wsId, date: today } }, create: { workspaceId: wsId, date: today, spentMicros: 0n, reservedMicros: 0n }, update: {} });
  try {
    const updated = await prisma.workspaceDailySpend.updateMany({
      where: { workspaceId: wsId, date: today, spentMicros: { lte: limitMicros }, reservedMicros: { lte: limitMicros - estimatedMicros } },
      data: { reservedMicros: { increment: estimatedMicros } },
    });
    return updated.count > 0;
  } catch { return false; }
}

export async function settleDailySpend(wsId: string, reservedMicros: bigint, actualCostMicros: bigint) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  await prisma.workspaceDailySpend.upsert({
    where: { workspaceId_date: { workspaceId: wsId, date: today } },
    create: { workspaceId: wsId, date: today, spentMicros: actualCostMicros, reservedMicros: 0n },
    update: { reservedMicros: { decrement: reservedMicros }, spentMicros: { increment: actualCostMicros } },
  });
}

export async function releaseDailySpend(wsId: string, reservedMicros: bigint) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  await prisma.workspaceDailySpend.updateMany({ where: { workspaceId: wsId, date: today }, data: { reservedMicros: { decrement: reservedMicros } } });
}

// ── Token estimation ──

export function estimateTokens(text: string): number {
  let tokens = 0, i = 0;
  while (i < text.length) {
    const code = text.charCodeAt(i);
    if (code >= 0x4E00 && code <= 0x9FFF) { tokens++; i++; }
    else if (code >= 0x3040 && code <= 0x30FF) { tokens++; i++; }
    else if (code >= 0xAC00 && code <= 0xD7AF) { tokens++; i++; }
    else { tokens++; i += 4; }
  }
  return tokens;
}

export async function getDailyChatCount(wsId: string): Promise<number> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return prisma.usageEvent.count({ where: { workspaceId: wsId, kind: "chat", createdAt: { gte: today } } });
}

export async function getDailyImageCount(wsId: string): Promise<number> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return prisma.usageEvent.count({ where: { workspaceId: wsId, kind: { in: ["image", "image-edit"] }, createdAt: { gte: today } } });
}

// ── Usage event lifecycle ──

export async function createUsageEvent(wsId: string, kind: string, model: string, credits: number): Promise<string> {
  const event = await prisma.usageEvent.create({ data: { workspaceId: wsId, kind, model, credits, settlement: "RESERVED" } });
  return event.id;
}

export async function recordUsageSettled(usageEventId: string, wsId: string, model: string, credits: number, usage?: { tokens?: number; cost?: number; generationId?: string }) {
  await prisma.usageEvent.update({
    where: { id: usageEventId },
    data: { model, credits, tokens: usage?.tokens ?? 0, costUsd: usage?.cost ? BigInt(Math.round(usage.cost * 1_000_000)) : 0n, generationId: usage?.generationId ?? null, settlement: "SETTLED" },
  });
}

export async function finalizeUsageAsReconciliationRequired(usageEventId: string) {
  await prisma.usageEvent.update({ where: { id: usageEventId }, data: { settlement: "RECONCILIATION_REQUIRED" } });
}

export async function releaseUsageReservation(usageEventId: string) {
  await prisma.usageEvent.update({ where: { id: usageEventId }, data: { settlement: "RELEASED" } });
}

// ── Inference attempts (created BEFORE fetch) ──

export async function createInferenceAttempt(usageEventId: string, attemptNumber: number, provider: string, modelServed: string): Promise<string> {
  const attempt = await prisma.inferenceAttempt.create({
    data: { usageEventId, attemptNumber, provider, modelServed, status: "CREATED" },
  });
  return attempt.id;
}

export async function markAttemptSent(attemptId: string) {
  await prisma.inferenceAttempt.update({ where: { id: attemptId }, data: { status: "SENT" } });
}

export async function settleAttempt(attemptId: string, generationId: string | null, costMicros: bigint, tokens: number) {
  await prisma.inferenceAttempt.update({ where: { id: attemptId }, data: { generationId, costMicros, tokens, status: "SETTLED" } });
}

export async function markAttemptReconciliationRequired(attemptId: string, generationId: string | null, errorMessage?: string) {
  await prisma.inferenceAttempt.update({ where: { id: attemptId }, data: { generationId, status: "RECONCILIATION_REQUIRED", errorMessage: errorMessage ?? null } });
}

export async function markAttemptFailed(attemptId: string, errorMessage?: string) {
  await prisma.inferenceAttempt.update({ where: { id: attemptId }, data: { status: "FAILED", errorMessage: errorMessage ?? null } });
}

// ── Backward-compat ──

export async function recordUsage(workspaceId: string, kind: string, model: string, credits: number, usage?: { tokens?: number; cost?: number; generationId?: string }) {
  await prisma.usageEvent.create({
    data: { workspaceId, kind, model, credits, tokens: usage?.tokens ?? 0, costUsd: usage?.cost ? BigInt(Math.round(usage.cost * 1_000_000)) : 0n, generationId: usage?.generationId ?? null, settlement: "SETTLED" },
  });
}
