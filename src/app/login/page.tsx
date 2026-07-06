"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/turnstile-widget";

const appName = "KRX";
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function continueAfterAuth() {
    const searchParams = new URLSearchParams(window.location.search);
    const plan = searchParams.get("plan");
    const billingCycle = searchParams.get("billingCycle") === "yearly" ? "yearly" : "monthly";
    if (plan) {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingCycle }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(data.error || "Could not open checkout");
      router.replace("/billing");
      return;
    }
    router.replace("/chat");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    setLoading(true);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, turnstileToken }),
    });
    setLoading(false);
    if (res.ok) {
      await continueAfterAuth();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Login failed");
    }
  }

  return (
    <div className="landing-theme min-h-screen px-5 py-8">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={appName} className="h-8 w-8 rounded-lg" />
          <span className="text-[15px] font-semibold tracking-[0.08em] text-[var(--landing-text)]">{appName}</span>
        </Link>
        <Link href="/signup" className="rounded-lg bg-[var(--landing-chip)] px-4 py-2 text-[13px] font-medium text-[var(--landing-text)] transition hover:opacity-80">
          Create account
        </Link>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-96px)] max-w-[1180px] items-center gap-12 py-12 lg:grid-cols-[0.95fr_0.85fr]">
        <div className="hidden max-w-xl lg:block">
          <p className="text-[13px] text-[var(--landing-faint)]">Private workspace</p>
          <h1 className="font-display mt-4 text-[42px] font-medium leading-[1.02] text-[var(--landing-text)]">
            Sign in privately.
          </h1>
        </div>

        <div className="w-full rounded-[28px] bg-[var(--landing-card)] p-5 shadow-[var(--landing-card-shadow)] sm:p-7">
          <h2 className="font-display text-[32px] font-medium leading-tight text-[var(--landing-text)]">Sign in</h2>
          <p className="mb-7 mt-2 text-sm text-[var(--landing-faint)]">Access your KRX workspace.</p>

        <a href="/api/auth/google" className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--landing-chip)] text-sm font-medium text-[var(--landing-body)] transition hover:bg-[var(--landing-chip)] hover:text-[var(--landing-text)]">
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </a>

        <div className="my-5 text-center">
          <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--landing-faint)]">or</span>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--landing-faint)]" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email"
              className="h-11 w-full rounded-lg bg-[var(--landing-field)] px-3 text-sm text-[var(--landing-text)] outline-none placeholder:text-[var(--landing-faint)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:ring-1 focus:ring-[var(--landing-faint)]"
              placeholder="name@company.com" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--landing-faint)]" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password"
              className="h-11 w-full rounded-lg bg-[var(--landing-field)] px-3 text-sm text-[var(--landing-text)] outline-none placeholder:text-[var(--landing-faint)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:ring-1 focus:ring-[var(--landing-faint)]"
              placeholder="Your password" />
          </div>
          {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} onVerify={setTurnstileToken} />}
          <button disabled={loading}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--landing-button)] text-sm font-medium text-[var(--landing-button-text)] transition hover:opacity-90 disabled:opacity-50">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <button
          onClick={async () => {
            const res = await fetch("/api/guest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turnstileToken }) });
            if (res.ok) router.replace("/chat");
            else toast.error((await res.json().catch(() => ({}))).error || "Could not start guest session");
          }}
          className="mt-3 flex h-11 w-full items-center justify-center rounded-lg bg-[var(--landing-chip)] text-sm font-medium text-[var(--landing-body)] transition hover:bg-[var(--landing-chip)] hover:text-[var(--landing-text)]"
        >
          Continue as guest - no account
        </button>

        <p className="mt-6 text-center text-xs text-[var(--landing-faint)]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-[var(--landing-text)] hover:underline">Create one</Link>
        </p>
        </div>
      </div>
    </div>
  );
}
