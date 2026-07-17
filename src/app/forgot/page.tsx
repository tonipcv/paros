"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { AuthField, AuthShell, authButtonClass, authInputClass } from "@/components/auth";

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
    <AuthShell
      title="Reset password"
      subtitle={sent ? undefined : "Enter your email and we'll send you a reset link."}
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-[var(--landing-text)] hover:underline">Sign in</Link>
        </>
      }
    >
      {sent ? (
        <>
          <p className="mb-6 text-sm text-[var(--landing-faint)]">
            If an account exists for that email, we&apos;ve sent a link to reset your password. The link expires in 1 hour.
          </p>
          <Link href="/login" className={authButtonClass}>
            Back to sign in
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <AuthField id="email" label="Email">
            <input id="email" name="email" type="email" required autoComplete="email"
              className={authInputClass} placeholder="name@company.com" />
          </AuthField>
          {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} onVerify={setTurnstileToken} />}
          <button disabled={loading} className={authButtonClass}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
