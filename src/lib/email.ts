// Transactional email sender.
//
// Primary transport is Cloudflare Email Service (native REST API) — the domain
// heuv.dev is onboarded for sending and Cloudflare manages DKIM/SPF/DMARC in its
// own DNS. MailChannels and Resend are kept as optional alternatives. If nothing
// is configured, sends are skipped (and logged) so flows like password reset
// degrade gracefully in dev.

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const MAILCHANNELS_ENDPOINT = "https://api.mailchannels.net/tx/v1/send";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

function mailchannelsEndpoint(): string {
  return process.env.MAILCHANNELS_ENDPOINT || MAILCHANNELS_ENDPOINT;
}

function cfAccountId(): string | undefined {
  return process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
}

function cfSendEndpoint(): string {
  return process.env.CF_EMAIL_ENDPOINT || `${CF_API_BASE}/accounts/${cfAccountId()}/email/sending/send`;
}

type Provider = "cloudflare" | "mailchannels" | "resend";

function selectedProvider(): Provider | null {
  const explicit = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (explicit === "cloudflare" || explicit === "mailchannels" || explicit === "resend") return explicit;
  if (process.env.CF_EMAIL_API_TOKEN && cfAccountId()) return "cloudflare";
  if (process.env.MAILCHANNELS_API_KEY || process.env.MAILCHANNELS_DKIM_PRIVATE_KEY) return "mailchannels";
  if (process.env.RESEND_API_KEY) return "resend";
  return null;
}

export function hasEmail(): boolean {
  return selectedProvider() !== null;
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM || "KRX <krx@heuv.dev>";
}

function parseFrom(): { email: string; name?: string } {
  const raw = emailFrom();
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(raw);
  if (m) return { name: m[1] || undefined, email: m[2].trim() };
  return { email: raw.trim() };
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

async function sendViaCloudflare(input: SendEmailInput): Promise<void> {
  const replyTo = input.replyTo || process.env.EMAIL_REPLY_TO;
  const res = await fetch(cfSendEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CF_EMAIL_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: input.to,
      from: emailFrom(),
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  const data = (await res.json().catch(() => null)) as
    | { success?: boolean; errors?: { code?: number; message?: string }[] }
    | null;
  if (!res.ok || !data?.success) {
    const msg = data?.errors?.map((e) => e.message).filter(Boolean).join("; ") || `HTTP ${res.status}`;
    throw new Error(`Cloudflare email send failed: ${msg}`);
  }
}

async function sendViaMailChannels(input: SendEmailInput): Promise<void> {
  const from = parseFrom();
  const personalization: Record<string, unknown> = { to: [{ email: input.to }] };

  // In-request DKIM signing: private key in env, public key published in
  // Cloudflare DNS at <selector>._domainkey.<domain>.
  const dkimDomain = process.env.MAILCHANNELS_DKIM_DOMAIN;
  const dkimKey = process.env.MAILCHANNELS_DKIM_PRIVATE_KEY;
  if (dkimDomain && dkimKey) {
    personalization.dkim_domain = dkimDomain;
    personalization.dkim_selector = process.env.MAILCHANNELS_DKIM_SELECTOR || "mailchannels";
    personalization.dkim_private_key = dkimKey;
  }

  const replyTo = input.replyTo || process.env.EMAIL_REPLY_TO;
  const body = {
    personalizations: [personalization],
    from: { email: from.email, ...(from.name ? { name: from.name } : {}) },
    subject: input.subject,
    content: [
      ...(input.text ? [{ type: "text/plain", value: input.text }] : []),
      { type: "text/html", value: input.html },
    ],
    ...(replyTo ? { reply_to: { email: replyTo } } : {}),
  };

  const res = await fetch(mailchannelsEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.MAILCHANNELS_API_KEY ? { "X-Api-Key": process.env.MAILCHANNELS_API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`MailChannels send failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}

async function sendViaResend(input: SendEmailInput): Promise<void> {
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
    throw new Error(`Resend send failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; skipped?: boolean }> {
  const provider = selectedProvider();
  if (!provider) {
    console.warn(`[email] no provider configured — skipping send to ${input.to} ("${input.subject}")`);
    return { ok: false, skipped: true };
  }
  if (provider === "mailchannels") await sendViaMailChannels(input);
  else if (provider === "cloudflare") await sendViaCloudflare(input);
  else await sendViaResend(input);
  return { ok: true };
}

// Enterprise-grade transactional email shell. 600px, conservative palette,
// header with logo + category label, rule dividers, and a formal footer with
// legal line, navigation links, postal address, and an automated-message notice.
// Table-based, inline styles only, no external CSS.
export function emailLayout(opts: {
  title: string;
  bodyHtml: string;
  preheader?: string;
  category?: string;
  footer?: string;
}): string {
  const year = new Date().getFullYear();
  const base = appUrl();
  const preheader = opts.preheader || opts.title;
  const address = process.env.EMAIL_COMPANY_ADDRESS || "KRX Labs · Private AI Infrastructure";
  const category = opts.category || "";
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="x-ua-compatible" content="ie=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#eceef1;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceef1;">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #dcdfe4;border-radius:6px;overflow:hidden;">
        <tr><td style="height:3px;background:#0b0f19;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:22px 32px;border-bottom:1px solid #e8eaee;">
          <img src="${base}/logo.png" width="24" height="24" alt="" style="border-radius:6px;vertical-align:middle;">
          <span style="font-size:15px;font-weight:700;letter-spacing:.02em;color:#0b0f19;padding-left:9px;vertical-align:middle;">${appName}</span>${category ? `<span style="font-size:14px;font-weight:400;color:#9aa0ac;padding-left:9px;vertical-align:middle;">&nbsp;·&nbsp; ${category}</span>` : ""}
        </td></tr>
        <tr><td style="padding:34px 32px 8px;">
          <h1 style="margin:0 0 18px;font-size:20px;line-height:1.35;font-weight:600;color:#0b0f19;">${opts.title}</h1>
          ${opts.bodyHtml}
        </td></tr>
        <tr><td style="padding:8px 32px 30px;"></td></tr>
        <tr><td style="padding:24px 32px;background:#f6f7f9;border-top:1px solid #e8eaee;">
          <p style="margin:0 0 14px;line-height:1;">
            <img src="${base}/logo.png" width="18" height="18" alt="" style="border-radius:4px;vertical-align:middle;opacity:.85;">
            <span style="font-size:13px;font-weight:600;letter-spacing:.02em;color:#6b7280;padding-left:8px;vertical-align:middle;">${appName}</span>
          </p>
          <p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#6b7280;">
            ${opts.footer || `This is an automated message regarding your ${appName} account. Please do not reply to this email.`}
          </p>
          <p style="margin:0 0 12px;font-size:12px;line-height:1;color:#6b7280;">
            <a href="${base}" style="color:#6b7280;text-decoration:none;">Help Center</a>
            &nbsp;·&nbsp;<a href="${base}/privacy" style="color:#6b7280;text-decoration:none;">Privacy Policy</a>
            &nbsp;·&nbsp;<a href="${base}/privacy" style="color:#6b7280;text-decoration:none;">Terms of Service</a>
            &nbsp;·&nbsp;<a href="mailto:krx@heuv.dev" style="color:#6b7280;text-decoration:none;">Contact</a>
          </p>
          <p style="margin:0;font-size:11px;line-height:1.5;color:#9aa0ac;">
            ${address} &nbsp;·&nbsp; &copy; ${year} ${appName}. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0b0f19;border-radius:6px;">
    <a href="${href}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;">${label}</a>
  </td></tr></table>`;
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#3a4048;">${html}</p>`;
}

export function muted(html: string): string {
  return `<p style="margin:0;font-size:13px;line-height:1.6;color:#8a909c;word-break:break-all;">${html}</p>`;
}
