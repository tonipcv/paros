import { randomUUID } from "node:crypto";
import type { ModelModality, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CREDIT_POLICY_VERSION, creditsToReserve, settleCredits } from "./unit-economics";

export type BillingMode = "shadow" | "enforced";

export function billingMode(): BillingMode {
  return process.env.VARIABLE_BILLING_MODE === "enforced" ? "enforced" : "shadow";
}

export type BillingReservationInput = {
  workspaceId: string;
  provider: string;
  model: string;
  modality: ModelModality;
  estimatedCostMicros: bigint;
  pricingVersion: string;
  requestId?: string;
  metadata?: Prisma.InputJsonValue;
  modeOverride?: BillingMode;
};

export async function createBillingReservation(input: BillingReservationInput) {
  const requestId = input.requestId || randomUUID();
  const creditsReserved = creditsToReserve(input.estimatedCostMicros);
  const mode = input.modeOverride || billingMode();

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { providerAccess: true },
    });
    if (!workspace?.providerAccess) throw new Error("Provider access is disabled for this workspace");

    if (mode === "enforced") {
      const charged = await tx.workspace.updateMany({
        where: { id: input.workspaceId, credits: { gte: creditsReserved } },
        data: { credits: { decrement: creditsReserved } },
      });
      if (!charged.count) throw new Error("Insufficient credits");
    }

    return tx.billingLedger.create({
      data: {
        workspaceId: input.workspaceId,
        requestId,
        provider: input.provider,
        model: input.model,
        modality: input.modality,
        reservedCostMicros: input.estimatedCostMicros,
        creditsReserved,
        pricingVersion: input.pricingVersion,
        creditPolicyVersion: CREDIT_POLICY_VERSION,
        metadata: { mode, ...(input.metadata && typeof input.metadata === "object" ? input.metadata : {}) },
      },
    });
  });
}

export async function markBillingSent(id: string, providerRequestId?: string) {
  return prisma.billingLedger.update({
    where: { id },
    data: { status: "SENT_TO_PROVIDER", providerRequestId, sentAt: new Date() },
  });
}

export type BillingSettlementInput = {
  providerRequestId?: string;
  providerCostMicros: bigint;
  providerFeeMicros?: bigint;
  toolsCostMicros?: bigint;
  privacyCostMicros?: bigint;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  imageMegapixels?: number;
  imageCount?: number;
  audioSeconds?: number;
  videoSeconds?: number;
};

export async function settleBillingReservation(id: string, input: BillingSettlementInput) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.billingLedger.findUnique({ where: { id } });
    if (!entry) throw new Error("Billing reservation not found");
    if (["SETTLED", "RELEASED"].includes(entry.status)) return entry;

    const providerFeeMicros = input.providerFeeMicros || 0n;
    const toolsCostMicros = input.toolsCostMicros || 0n;
    const privacyCostMicros = input.privacyCostMicros || 0n;
    const settledCostMicros = input.providerCostMicros + providerFeeMicros + toolsCostMicros + privacyCostMicros;
    const settlement = settleCredits(entry.creditsReserved, settledCostMicros);
    const mode = (entry.metadata as { mode?: BillingMode } | null)?.mode || "shadow";

    // Atomic claim: only one concurrent settle/release can transition the
    // reservation out of its current state — later callers observe the final row.
    const claim = await tx.billingLedger.updateMany({
      where: { id, status: entry.status },
      data: {
        status: "SETTLED",
        providerRequestId: input.providerRequestId,
        providerCostMicros: input.providerCostMicros,
        providerFeeMicros,
        toolsCostMicros,
        privacyCostMicros,
        settledCostMicros,
        creditsSettled: settlement.creditsSettled,
        inputTokens: input.inputTokens || 0,
        outputTokens: input.outputTokens || 0,
        cachedTokens: input.cachedTokens || 0,
        imageMegapixels: input.imageMegapixels || 0,
        imageCount: input.imageCount || 0,
        audioSeconds: input.audioSeconds || 0,
        videoSeconds: input.videoSeconds || 0,
        settledAt: new Date(),
      },
    });
    if (!claim.count) return tx.billingLedger.findUnique({ where: { id } });

    if (mode === "enforced" && settlement.creditsAdditional > 0) {
      const charged = await tx.workspace.updateMany({
        where: { id: entry.workspaceId, credits: { gte: settlement.creditsAdditional } },
        data: { credits: { decrement: settlement.creditsAdditional } },
      });
      if (!charged.count) {
        return tx.billingLedger.update({
          where: { id },
          data: {
            status: "RECONCILIATION_REQUIRED",
            providerRequestId: input.providerRequestId,
            providerCostMicros: input.providerCostMicros,
            providerFeeMicros,
            toolsCostMicros,
            privacyCostMicros,
            settledCostMicros,
            creditsSettled: settlement.creditsSettled,
          },
        });
      }
    } else if (mode === "enforced" && settlement.creditsRefunded > 0) {
      await tx.workspace.update({
        where: { id: entry.workspaceId },
        data: { credits: { increment: settlement.creditsRefunded } },
      });
    }

    return tx.billingLedger.findUnique({ where: { id } });
  }, { isolationLevel: "Serializable" });
}

export async function releaseBillingReservation(id: string, failed = false) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.billingLedger.findUnique({ where: { id } });
    if (!entry || ["SETTLED", "RELEASED"].includes(entry.status)) return entry;
    // Atomic claim — a concurrent settle/release wins the transition instead.
    const claim = await tx.billingLedger.updateMany({
      where: { id, status: entry.status },
      data: { status: failed ? "FAILED" : "RELEASED", settledAt: new Date() },
    });
    if (!claim.count) return tx.billingLedger.findUnique({ where: { id } });
    const mode = (entry.metadata as { mode?: BillingMode } | null)?.mode || "shadow";
    if (mode === "enforced" && entry.creditsReserved > 0) {
      await tx.workspace.update({ where: { id: entry.workspaceId }, data: { credits: { increment: entry.creditsReserved } } });
    }
    return tx.billingLedger.findUnique({ where: { id } });
  }, { isolationLevel: "Serializable" });
}

export async function requireBillingReconciliation(id: string, providerRequestId?: string) {
  return prisma.billingLedger.update({
    where: { id },
    data: { status: "RECONCILIATION_REQUIRED", providerRequestId, settledAt: new Date() },
  });
}

export async function createUnpricedShadowReservation(input: {
  workspaceId: string;
  provider: string;
  model: string;
  modality: ModelModality;
  estimatedCostMicros: bigint;
  surface: string;
  legacyCreditsCharged: number;
}) {
  return createBillingReservation({
    ...input,
    pricingVersion: `unpriced:${input.provider}:${input.model}`,
    modeOverride: "shadow",
    metadata: { surface: input.surface, legacyCreditsCharged: input.legacyCreditsCharged, priceRequired: true },
  });
}
