"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { AuthDivider, AuthField, AuthShell, GoogleButton, authButtonClass, authInputClass } from "@/components/auth";

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
    <AuthShell
      title="Welcome back"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-[var(--landing-text)] hover:underline">Sign up</Link>
        </>
      }
    >
      <GoogleButton />
      <AuthDivider />

      <form onSubmit={submit} className="space-y-4">
        <AuthField id="email" label="Email">
          <input id="email" name="email" type="email" required autoComplete="email"
            className={authInputClass} placeholder="name@company.com" />
        </AuthField>
        <AuthField id="password" label="Password">
          <input id="password" name="password" type="password" required autoComplete="current-password"
            className={authInputClass} placeholder="Your password" />
          <div className="mt-1.5 text-right">
            <Link href="/forgot" className="text-[11px] text-[var(--landing-faint)] hover:text-[var(--landing-text)] hover:underline">Forgot password?</Link>
          </div>
        </AuthField>
        {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} onVerify={setTurnstileToken} />}
        <button disabled={loading} className={authButtonClass}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
