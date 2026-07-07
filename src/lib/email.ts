// Transactional email sender.
//
// Cloudflare provides inbound Email Routing for the domain (receiving
// krx@heuv.dev), but has no transactional *outbound* API — so outbound mail is
// sent through an ESP (Resend by default) whose sender domain is authenticated
// with DKIM/SPF/DMARC records living in Cloudflare DNS for heuv.dev.
//
// If no provider is configured, sends are skipped (and logged) rather than
// throwing, so flows like password reset degrade gracefully in dev.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function hasEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM || "KRX <krx@heuv.dev>";
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012";
}

const appName = process.env.NEXT_PUBLIC_APP_NAME || "KRX";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!hasEmail()) {
    console.warn(`[email] RESEND_API_KEY not set — skipping send to ${input.to} ("${input.subject}")`);
    return { ok: false, skipped: true };
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(input.replyTo || process.env.EMAIL_REPLY_TO
        ? { reply_to: input.replyTo || process.env.EMAIL_REPLY_TO }
        : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return { ok: true };
}

// Minimal, client-agnostic HTML shell — inline styles, no external assets.
export function emailLayout(opts: { title: string; bodyHtml: string; footer?: string }): string {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0b0b0b;color:#e9e9e9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:18px;font-weight:600;letter-spacing:.2px;color:#fff;margin-bottom:24px;">${appName}</div>
    <div style="background:#141414;border:1px solid #242424;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:18px;color:#fff;">${opts.title}</h1>
      ${opts.bodyHtml}
    </div>
    <p style="margin:20px 4px 0;font-size:12px;color:#8a8a8a;line-height:1.6;">
      ${opts.footer || `You're receiving this because someone used your email at ${appName}. If it wasn't you, you can safely ignore it.`}
    </p>
    <p style="margin:8px 4px 0;font-size:11px;color:#5a5a5a;">&copy; ${year} ${appName}</p>
  </div>
</body></html>`;
}

export function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#fff;color:#0b0b0b;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;">${label}</a>`;
}
