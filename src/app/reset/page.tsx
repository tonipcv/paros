"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthField, AuthShell, authButtonClass, authInputClass } from "@/components/auth";

export default function ResetPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") || "";
    setToken(t);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.replace("/login"), 1800);
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Could not reset password");
    }
  }

  return (
    <AuthShell title="Set a new password" subtitle={!done && token ? "Choose a new password. This signs you out of other devices." : undefined}>
      {done ? (
        <p className="text-sm text-[var(--landing-faint)]">
          Password updated. Redirecting you to sign in…
        </p>
      ) : !token ? (
        <>
          <p className="mb-6 text-sm text-[var(--landing-faint)]">
            This reset link is missing or invalid. Request a new one.
          </p>
          <Link href="/forgot" className={authButtonClass}>
            Request reset link
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <AuthField id="password" label="New password">
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password"
              className={authInputClass} placeholder="At least 8 characters" />
          </AuthField>
          <AuthField id="confirm" label="Confirm password">
            <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password"
              className={authInputClass} placeholder="Repeat password" />
          </AuthField>
          <button disabled={loading} className={authButtonClass}>
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
