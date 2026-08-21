import { clientIp } from "./rate-limit";

export function turnstileEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(token: string | undefined, request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Fail closed in production: a missing secret must never silently disable
    // bot protection on signup/login/guest/password-reset. Dev keeps working.
    if (process.env.NODE_ENV === "production") {
      console.error("TURNSTILE_SECRET_KEY is missing in production — refusing");
      return { ok: false as const, error: "Security configuration error" };
    }
    return { ok: true as const };
  }
  if (!token) return { ok: false as const, error: "Human verification is required" };

  const ip = clientIp(request);
  const res = await fetch(process.env.TURNSTILE_SITEVERIFY_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, ...(ip && ip !== "unknown" ? { remoteip: ip } : {}) }),
  });
  const body = await res.json().catch(() => ({}));
  return body.success ? { ok: true as const } : { ok: false as const, error: "Human verification failed" };
}
