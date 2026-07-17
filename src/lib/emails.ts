// Centralized transactional emails. Each function composes a message with the
// shared enterprise template (lib/email) and sends it best-effort. Call sites
// should not await/‑block critical paths and should swallow errors.

import { appUrl, button, emailLayout, muted, paragraph, sendEmail } from "./email";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "NotOpen";
const CONTACT = process.env.EMAIL_REPLY_TO || "notopen@heuv.dev";

function fmtDate(d: Date = new Date()): string {
  return (
    d.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC"
  );
}

export async function sendWelcomeEmail(to: string, name?: string) {
  return sendEmail({
    to,
    subject: `Welcome to ${appName}`,
    html: emailLayout({
      title: `Welcome to ${appName}`,
      preheader: "Your private AI workspace is ready.",
      bodyHtml:
        paragraph(`Hello${name ? ` ${name}` : ""},`) +
        paragraph(
          `Thank you for creating a ${appName} account. Your private AI workspace is now active. You can chat with frontier and open models, generate images, and select the privacy posture that fits your work, from zero-retention routing to hardware-attested TEE and end-to-end encryption.`
        ) +
        `<p style="margin:0 0 8px;">${button(`${appUrl()}/chat`, "Open your workspace")}</p>`,
      footer: `You are receiving this message because an account was created with this email address at ${appName}. If this was not you, please contact ${CONTACT}.`,
    }),
    text: `Welcome to ${appName}. Open your workspace: ${appUrl()}/chat`,
  });
}

export async function sendPasswordResetEmail(to: string, link: string) {
  return sendEmail({
    to,
    subject: "Password reset request",
    html: emailLayout({
      title: "Password reset request",
      preheader: "Use this secure link to set a new password. It expires in 1 hour.",
      bodyHtml:
        paragraph("Hello,") +
        paragraph(
          `We received a request to reset the password for your ${appName} account. To proceed, select the button below. For your security, this link will expire in <b>1 hour</b> and may be used only once.`
        ) +
        `<p style="margin:0 0 22px;">${button(link, "Reset password")}</p>` +
        paragraph("If the button above does not work, copy and paste the following link into your browser:") +
        muted(link),
      footer: `If you did not request a password reset, no action is required. Your password will remain unchanged. For assistance, contact ${CONTACT}.`,
    }),
    text: `Password reset request\n\nWe received a request to reset the password for your ${appName} account. Use the secure link below (expires in 1 hour, single use):\n${link}\n\nIf you did not request this, no action is required.`,
  });
}

export async function sendPasswordChangedEmail(to: string) {
  return sendEmail({
    to,
    subject: "Your password was changed",
    html: emailLayout({
      title: "Your password was changed",
      preheader: "This confirms your account password was updated.",
      bodyHtml:
        paragraph("Hello,") +
        paragraph(
          `This is a confirmation that the password for your ${appName} account was changed on <b>${fmtDate()}</b>. For your security, you have been signed out of all devices.`
        ) +
        paragraph("If you made this change, no further action is required.") +
        `<p style="margin:0 0 8px;">${button(`${appUrl()}/forgot`, "Secure your account")}</p>`,
      footer: `If you did not change your password, reset it immediately using the button above and contact ${CONTACT}.`,
    }),
    text: `Your ${appName} password was changed on ${fmtDate()}. If this wasn't you, reset it immediately: ${appUrl()}/forgot`,
  });
}

export async function sendPaymentConfirmedEmail(
  to: string,
  opts: { planName: string; credits: number; cycle?: "monthly" | "yearly" }
) {
  const cycle = opts.cycle === "yearly" ? "annual" : "monthly";
  return sendEmail({
    to,
    subject: `Your ${appName} subscription is active`,
    html: emailLayout({
      title: "Subscription confirmed",
      preheader: `Your ${opts.planName} plan is now active.`,
      bodyHtml:
        paragraph("Hello,") +
        paragraph(
          `Thank you for your purchase. Your <b>${opts.planName}</b> plan (${cycle} billing) is now active, and <b>${opts.credits.toLocaleString("en-US")} credits</b> have been added to your workspace.`
        ) +
        `<p style="margin:0 0 8px;">${button(`${appUrl()}/billing`, "View billing")}</p>`,
      footer: `A receipt for this payment is available from your billing portal. For questions, contact ${CONTACT}.`,
    }),
    text: `Your ${appName} ${opts.planName} plan is active. ${opts.credits} credits added. Manage billing: ${appUrl()}/billing`,
  });
}

export async function sendPaymentFailedEmail(to: string, opts: { planName?: string } = {}) {
  const plan = opts.planName ? ` for your ${opts.planName} plan` : "";
  return sendEmail({
    to,
    subject: "Action required: payment failed",
    html: emailLayout({
      title: "We couldn't process your payment",
      preheader: "Please update your payment method to keep your plan active.",
      bodyHtml:
        paragraph("Hello,") +
        paragraph(
          `We were unable to process your most recent payment${plan}. To avoid an interruption to your service, please update your payment method.`
        ) +
        `<p style="margin:0 0 8px;">${button(`${appUrl()}/billing`, "Update payment method")}</p>`,
      footer: `If you believe this is an error or need assistance, contact ${CONTACT}.`,
    }),
    text: `We couldn't process your payment${plan}. Update your payment method: ${appUrl()}/billing`,
  });
}

export async function sendSubscriptionCanceledEmail(to: string) {
  return sendEmail({
    to,
    subject: "Your subscription was canceled",
    html: emailLayout({
      title: "Your subscription was canceled",
      preheader: "Your account has reverted to the Free plan.",
      bodyHtml:
        paragraph("Hello,") +
        paragraph(
          `Your ${appName} subscription has been canceled and your account has reverted to the Free plan. You can continue using ${appName} with the Free plan's limits, or reactivate a paid plan at any time.`
        ) +
        `<p style="margin:0 0 8px;">${button(`${appUrl()}/billing`, "Reactivate a plan")}</p>`,
      footer: `We're sorry to see you go. If you have feedback or need assistance, contact ${CONTACT}.`,
    }),
    text: `Your ${appName} subscription was canceled; your account is now on the Free plan. Reactivate: ${appUrl()}/billing`,
  });
}

export async function sendApiKeyCreatedEmail(to: string, keyName: string) {
  return sendEmail({
    to,
    subject: "A new API key was created",
    html: emailLayout({
      title: "A new API key was created",
      preheader: "A new API key was added to your account.",
      bodyHtml:
        paragraph("Hello,") +
        paragraph(
          `A new API key named <b>${keyName}</b> was created on your ${appName} account on <b>${fmtDate()}</b>. Keep your API keys secret; anyone with a key can use your credits.`
        ) +
        `<p style="margin:0 0 8px;">${button(`${appUrl()}/keys`, "Manage API keys")}</p>`,
      footer: `If you did not create this key, revoke it immediately from the API keys page and contact ${CONTACT}.`,
    }),
    text: `A new API key "${keyName}" was created on your ${appName} account on ${fmtDate()}. If this wasn't you, revoke it: ${appUrl()}/keys`,
  });
}

export async function sendApiKeyRevokedEmail(to: string, keyName: string) {
  return sendEmail({
    to,
    subject: "An API key was revoked",
    html: emailLayout({
      title: "An API key was revoked",
      preheader: "An API key was removed from your account.",
      bodyHtml:
        paragraph("Hello,") +
        paragraph(
          `The API key named <b>${keyName}</b> was revoked from your ${appName} account on <b>${fmtDate()}</b> and can no longer be used.`
        ) +
        `<p style="margin:0 0 8px;">${button(`${appUrl()}/keys`, "Manage API keys")}</p>`,
      footer: `If you did not revoke this key, secure your account and contact ${CONTACT}.`,
    }),
    text: `The API key "${keyName}" was revoked from your ${appName} account on ${fmtDate()}. Manage keys: ${appUrl()}/keys`,
  });
}

export async function sendVerifyEmail(to: string, link: string) {
  return sendEmail({
    to,
    subject: "Verify your email address",
    html: emailLayout({
      title: "Verify your email address",
      preheader: "Confirm your email to secure your account.",
      bodyHtml:
        paragraph("Hello,") +
        paragraph(
          `Please confirm that this is the email address for your ${appName} account by selecting the button below. This link expires in <b>24 hours</b>.`
        ) +
        `<p style="margin:0 0 22px;">${button(link, "Verify email")}</p>` +
        paragraph("If the button above does not work, copy and paste the following link into your browser:") +
        muted(link),
      footer: `If you did not create a ${appName} account, you can safely ignore this email.`,
    }),
    text: `Verify your email for ${appName} (expires in 24 hours):\n${link}`,
  });
}

export async function sendNewSignInEmail(
  to: string,
  ctx: { ip?: string; userAgent?: string } = {}
) {
  const details =
    (ctx.ip ? `IP address: ${ctx.ip}<br>` : "") + (ctx.userAgent ? `Device: ${ctx.userAgent}` : "");
  return sendEmail({
    to,
    subject: "New sign-in to your account",
    html: emailLayout({
      title: "New sign-in to your account",
      preheader: "We noticed a new sign-in to your account.",
      bodyHtml:
        paragraph("Hello,") +
        paragraph(`Your ${appName} account was signed in to on <b>${fmtDate()}</b>.`) +
        (details ? muted(details) + `<div style="height:16px"></div>` : "") +
        paragraph("If this was you, no action is required.") +
        `<p style="margin:0 0 8px;">${button(`${appUrl()}/forgot`, "Secure your account")}</p>`,
      footer: `If you do not recognize this activity, reset your password immediately and contact ${CONTACT}.`,
    }),
    text: `New sign-in to your ${appName} account on ${fmtDate()}.${ctx.ip ? ` IP: ${ctx.ip}.` : ""} If this wasn't you, reset your password: ${appUrl()}/forgot`,
  });
}

export async function sendRenewalReceiptEmail(
  to: string,
  opts: { planName: string; credits: number }
) {
  return sendEmail({
    to,
    subject: `Your ${appName} subscription renewed`,
    html: emailLayout({
      title: "Subscription renewed",
      preheader: `Your ${opts.planName} plan renewed for a new billing period.`,
      bodyHtml:
        paragraph("Hello,") +
        paragraph(
          `Your <b>${opts.planName}</b> subscription has renewed for a new billing period, and <b>${opts.credits.toLocaleString("en-US")} credits</b> have been added to your workspace.`
        ) +
        `<p style="margin:0 0 8px;">${button(`${appUrl()}/billing`, "View billing")}</p>`,
      footer: `A receipt for this payment is available from your billing portal. For questions, contact ${CONTACT}.`,
    }),
    text: `Your ${appName} ${opts.planName} plan renewed. ${opts.credits} credits added. Billing: ${appUrl()}/billing`,
  });
}

export async function sendPlanChangedEmail(to: string, opts: { planName: string }) {
  return sendEmail({
    to,
    subject: "Your plan was updated",
    html: emailLayout({
      title: "Your plan was updated",
      preheader: `Your subscription is now on the ${opts.planName} plan.`,
      bodyHtml:
        paragraph("Hello,") +
        paragraph(
          `Your ${appName} subscription has been updated. Your account is now on the <b>${opts.planName}</b> plan, effective ${fmtDate()}.`
        ) +
        `<p style="margin:0 0 8px;">${button(`${appUrl()}/billing`, "View billing")}</p>`,
      footer: `If you did not request this change, contact ${CONTACT}.`,
    }),
    text: `Your ${appName} plan was updated to ${opts.planName}. Billing: ${appUrl()}/billing`,
  });
}

export async function sendAccountDeletedEmail(to: string) {
  return sendEmail({
    to,
    subject: "Your account has been deleted",
    html: emailLayout({
      title: "Your account has been deleted",
      preheader: "Confirmation that your account and data were removed.",
      bodyHtml:
        paragraph("Hello,") +
        paragraph(
          `This confirms that your ${appName} account was deleted on <b>${fmtDate()}</b>, along with its associated data. Any active subscription has been canceled.`
        ) +
        paragraph("We're sorry to see you go. You're welcome back any time."),
      footer: `If you did not request this deletion, contact ${CONTACT} immediately.`,
    }),
    text: `Your ${appName} account was deleted on ${fmtDate()}. If this wasn't you, contact ${CONTACT}.`,
  });
}
