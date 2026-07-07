"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { TurnstileWidget } from "@/components/turnstile-widget";

const appName = "KRX";
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function ForgotPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") || "").trim();
    setLoading(true);
    await fetch("/api/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, turnstileToken }),
    }).catch(() => {});
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="landing-theme min-h-screen px-5 py-8">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={appName} className="h-8 w-8 rounded-lg" />
          <span className="text-[15px] font-semibold tracking-[0.08em] text-[var(--landing-text)]">{appName}</span>
        </Link>
        <Link href="/login" className="rounded-lg bg-[var(--landing-chip)] px-4 py-2 text-[13px] font-medium text-[var(--landing-text)] transition hover:opacity-80">
          Sign in
        </Link>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-96px)] max-w-[480px] items-center py-12">
        <div className="w-full rounded-[28px] bg-[var(--landing-card)] p-5 shadow-[var(--landing-card-shadow)] sm:p-7">
          <h2 className="font-display text-[32px] font-medium leading-tight text-[var(--landing-text)]">Reset password</h2>

          {sent ? (
            <>
              <p className="mb-7 mt-2 text-sm text-[var(--landing-faint)]">
                If an account exists for that email, we&apos;ve sent a link to reset your password. The link expires in 1 hour.
              </p>
              <Link href="/login" className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--landing-button)] text-sm font-medium text-[var(--landing-button-text)] transition hover:opacity-90">
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <p className="mb-7 mt-2 text-sm text-[var(--landing-faint)]">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--landing-faint)]" htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" required autoComplete="email"
                    className="h-11 w-full rounded-lg bg-[var(--landing-field)] px-3 text-sm text-[var(--landing-text)] outline-none placeholder:text-[var(--landing-faint)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:ring-1 focus:ring-[var(--landing-faint)]"
                    placeholder="name@company.com" />
                </div>
                {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} onVerify={setTurnstileToken} />}
                <button disabled={loading}
                  className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--landing-button)] text-sm font-medium text-[var(--landing-button-text)] transition hover:opacity-90 disabled:opacity-50">
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>
              <p className="mt-6 text-center text-xs text-[var(--landing-faint)]">
                Remembered it?{" "}
                <Link href="/login" className="font-medium text-[var(--landing-text)] hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
