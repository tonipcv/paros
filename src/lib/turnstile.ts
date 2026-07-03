export function turnstileEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(token: string | undefined, request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true as const };
  if (!token) return { ok: false as const, error: "Human verification is required" };

  const ip =
    request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0];
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
  });
  const body = await res.json().catch(() => ({}));
  return body.success ? { ok: true as const } : { ok: false as const, error: "Human verification failed" };
}
