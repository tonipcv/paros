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

// A real, client-agnostic transactional email shell: hidden preheader, logo,
// wordmark, a bordered card, CTA, and a footer. Inline styles only, no external
// CSS. The logo is served from the app's public assets over HTTPS.
export function emailLayout(opts: { title: string; bodyHtml: string; preheader?: string; footer?: string }): string {
  const year = new Date().getFullYear();
  const base = appUrl();
  const preheader = opts.preheader || opts.title;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="padding:0 4px 20px;">
          <a href="${base}" style="text-decoration:none;color:#0b0b0b;display:inline-flex;align-items:center;">
            <img src="${base}/logo.png" width="28" height="28" alt="${appName}" style="border-radius:7px;vertical-align:middle;">
            <span style="font-size:16px;font-weight:700;letter-spacing:.02em;color:#0b0b0b;padding-left:10px;vertical-align:middle;">${appName}</span>
          </a>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e6e6e8;border-radius:16px;padding:32px;">
          <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;font-weight:650;color:#0b0b0b;">${opts.title}</h1>
          ${opts.bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 6px 0;">
          <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#8a8a8f;">
            ${opts.footer || `This is a transactional email from ${appName}. If you didn't request it, you can safely ignore this message.`}
          </p>
          <p style="margin:0;font-size:12px;color:#a0a0a5;">
            <a href="${base}/privacy" style="color:#8a8a8f;text-decoration:underline;">Privacy</a>
            &nbsp;·&nbsp; &copy; ${year} ${appName}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#0b0b0b;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;line-height:1;padding:13px 22px;border-radius:10px;">${label}</a>`;
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#3f3f46;">${html}</p>`;
}

export function muted(html: string): string {
  return `<p style="margin:0;font-size:13px;line-height:1.6;color:#8a8a8f;word-break:break-all;">${html}</p>`;
}
