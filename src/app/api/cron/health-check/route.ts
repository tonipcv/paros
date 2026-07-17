import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hasEmail, emailFrom } from "@/lib/email";
import { sendEmail, emailLayout, paragraph } from "@/lib/email";
import { runAllChecks, persistAndDetectChanges } from "@/lib/monitor";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour — don't spam alerts

async function sendAlert(title: string, items: string[]) {
  if (!hasEmail()) {
    console.warn(`[health] alert suppressed — no email provider configured. ${title}`);
    return;
  }
  const to = process.env.EMAIL_ALERT_RECIPIENT || process.env.EMAIL_REPLY_TO || "notopen@heuv.dev";
  const html = emailLayout({
    title,
    bodyHtml:
      paragraph(`The following checks are reporting issues at ${new Date().toISOString()}:`) +
      `<ul style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#3a4048;">${items
        .map((i) => `<li>${i}</li>`)
        .join("")}</ul>` +
      paragraph(
        `The system will check again on the next scheduled run. No further alerts will be sent for these same issues within the next hour.`
      ),
    footer: "This is an automated health monitoring alert. Review the dashboard at /health.",
  });

  // Cooldown: don't re-send within the hour.
  const lastAlert = await prisma.healthCheck.findFirst({
    where: { alertSent: true, createdAt: { gte: new Date(Date.now() - ALERT_COOLDOWN_MS) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastAlert) {
    console.log(`[health] alert cooldown active — last alert at ${lastAlert.createdAt.toISOString()}`);
    return;
  }

  try {
    const result = await sendEmail({ to, subject: title, html, text: title + "\n" + items.join("\n") });
    if (!result.ok && !result.skipped) {
      console.error(`[health] failed to send alert: ${title}`);
    } else {
      console.log(`[health] alert sent: ${title}`);
    }
  } catch (e) {
    console.error("[health] alert send error:", e);
  }
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  console.log("[health] running checks...");
  const checks = await runAllChecks();
  const changed = await persistAndDetectChanges(checks);

  if (changed.length > 0) {
    const items = changed.map((c) => `<b>${c.name}</b>: ${c.message || c.status} (${c.durationMs}ms)`);
    const label = changed.some((c) => c.status === "down") ? "System health alert" : "System degradation";
    await sendAlert(label, items).catch((e) => console.error("[health] sendAlert failed:", e));
  }

  // Also clean old records (keep last 7 days).
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.healthCheck.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {});

  return new Response(JSON.stringify({ checks: checks.length, changed: changed.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
