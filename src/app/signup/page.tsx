"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { AuthDivider, AuthField, AuthShell, GoogleButton, authButtonClass, authInputClass } from "@/components/auth";
import { findPlan, formatCredits } from "@/lib/models";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const freeCredits = findPlan("FREE")?.credits ?? 10;

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, turnstileToken }),
    });
    setLoading(false);
    if (res.ok) {
      router.replace("/onboarding");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Signup failed");
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle={`Start with ${formatCredits(freeCredits)} free credits.`}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--landing-text)] hover:underline">Sign in</Link>
        </>
      }
    >
      <GoogleButton />
      <AuthDivider />

      <form onSubmit={submit} className="space-y-4">
        <AuthField id="name" label="Name">
          <input id="name" name="name" type="text" autoComplete="name"
            className={authInputClass} placeholder="Your name" />
        </AuthField>
        <AuthField id="email" label="Email">
          <input id="email" name="email" type="email" required autoComplete="email"
            className={authInputClass} placeholder="name@company.com" />
        </AuthField>
        <AuthField id="password" label="Password">
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password"
            className={authInputClass} placeholder="At least 8 characters" />
        </AuthField>
        {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} onVerify={setTurnstileToken} />}
        <button disabled={loading} className={authButtonClass}>
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
