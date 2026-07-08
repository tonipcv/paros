// System health checks — probes every critical dependency and returns a
// structured result so the cron and the dashboard share the same logic.

import { prisma } from "./prisma";
import { verifyTeeAttestation } from "./attestation";
import { hasEmail } from "./email";
import { stripe } from "./stripe";

export type CheckResult = {
  name: string;
  status: "healthy" | "degraded" | "down";
  message?: string;
  durationMs?: number;
};

async function check(name: string, fn: () => Promise<{ status: CheckResult["status"]; message?: string }>): Promise<CheckResult> {
  const start = Date.now();
  let result: { status: CheckResult["status"]; message?: string };
  try {
    result = await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result = { status: "down", message: msg };
  }
  return { name, status: result.status, message: result.message, durationMs: Date.now() - start };
}

export async function runAllChecks(): Promise<CheckResult[]> {
  return Promise.all([
    check("db", async () => {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "healthy" };
    }),

    check("attestation:tee", async () => {
      const r = await verifyTeeAttestation("tee");
      if (r.verified) return { status: "healthy" };
      return { status: "down", message: r.reason || "Unverified" };
    }),

    check("attestation:e2ee", async () => {
      const r = await verifyTeeAttestation("e2ee");
      if (r.verified) return { status: "healthy" };
      return { status: "down", message: r.reason || "Unverified" };
    }),

    check("email:provider", async () => {
      if (hasEmail()) return { status: "healthy" };
      return { status: "degraded", message: "No email provider configured" };
    }),

    check("stripe:webhook", async () => {
      if (!process.env.STRIPE_SECRET_KEY) {
        return { status: "degraded", message: "STRIPE_SECRET_KEY not configured" };
      }
      try {
        const { data } = await stripe().webhookEndpoints.list({ limit: 20 });
        const krx = data.find((e) => /plataform\.krxlab\.com/.test(e.url));
        if (!krx) return { status: "down", message: "No webhook endpoint for plataform.krxlab.com" };
        if (krx.status !== "enabled") return { status: "degraded", message: `Webhook status: ${krx.status}` };
        if (krx.enabled_events.length < 5) return { status: "degraded", message: `Only ${krx.enabled_events.length} events enabled` };
        return { status: "healthy" };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { status: "degraded", message: msg };
      }
    }),
  ]);
}

// Persist checks and return which ones degraded or went down (used for alerts).
export async function persistAndDetectChanges(checks: CheckResult[]): Promise<CheckResult[]> {
  const changed: CheckResult[] = [];
  for (const c of checks) {
    // Find the most recent check for the same name to compare status.
    const prev = await prisma.healthCheck.findFirst({
      where: { name: c.name },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    });
    const degraded = c.status !== "healthy";
    const newlyDegraded = degraded && (!prev || prev.status === "healthy");
    await prisma.healthCheck.create({
      data: {
        name: c.name,
        status: c.status,
        message: c.message,
        durationMs: c.durationMs,
        alertSent: newlyDegraded,
      },
    });
    if (newlyDegraded) changed.push(c);
  }
  return changed;
}

// Summary for the dashboard API.
export async function latestSummary(): Promise<{ checks: (CheckResult & { lastCheck: string })[];
  degraded: number; total: number }> {
  const names = ["db", "attestation:tee", "attestation:e2ee", "email:provider", "stripe:webhook"];
  const checks = await Promise.all(
    names.map(async (name) => {
      const row = await prisma.healthCheck.findFirst({
        where: { name },
        orderBy: { createdAt: "desc" },
        select: { status: true, message: true, durationMs: true, createdAt: true },
      });
      const cr: CheckResult & { lastCheck: string } = {
        name,
        status: (row?.status as CheckResult["status"]) || "healthy",
        message: row?.message || undefined,
        durationMs: row?.durationMs ?? undefined,
        lastCheck: row?.createdAt?.toISOString() || "never",
      };
      return cr;
    })
  );
  return { checks, degraded: checks.filter((c) => c.status !== "healthy").length, total: checks.length };
}
