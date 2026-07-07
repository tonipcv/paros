"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const appName = "KRX";

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
    <div className="landing-theme min-h-screen px-5 py-8">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={appName} className="h-8 w-8 rounded-lg" />
          <span className="text-[15px] font-semibold tracking-[0.08em] text-[var(--landing-text)]">{appName}</span>
        </Link>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-96px)] max-w-[480px] items-center py-12">
        <div className="w-full rounded-[28px] bg-[var(--landing-card)] p-5 shadow-[var(--landing-card-shadow)] sm:p-7">
          <h2 className="font-display text-[32px] font-medium leading-tight text-[var(--landing-text)]">Set a new password</h2>

          {done ? (
            <p className="mb-2 mt-2 text-sm text-[var(--landing-faint)]">
              Password updated. Redirecting you to sign in…
            </p>
          ) : !token ? (
            <>
              <p className="mb-7 mt-2 text-sm text-[var(--landing-faint)]">
                This reset link is missing or invalid. Request a new one.
              </p>
              <Link href="/forgot" className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--landing-button)] text-sm font-medium text-[var(--landing-button-text)] transition hover:opacity-90">
                Request reset link
              </Link>
            </>
          ) : (
            <>
              <p className="mb-7 mt-2 text-sm text-[var(--landing-faint)]">
                Choose a new password. This signs you out of other devices.
              </p>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--landing-faint)]" htmlFor="password">New password</label>
                  <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password"
                    className="h-11 w-full rounded-lg bg-[var(--landing-field)] px-3 text-sm text-[var(--landing-text)] outline-none placeholder:text-[var(--landing-faint)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:ring-1 focus:ring-[var(--landing-faint)]"
                    placeholder="At least 8 characters" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--landing-faint)]" htmlFor="confirm">Confirm password</label>
                  <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password"
                    className="h-11 w-full rounded-lg bg-[var(--landing-field)] px-3 text-sm text-[var(--landing-text)] outline-none placeholder:text-[var(--landing-faint)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:ring-1 focus:ring-[var(--landing-faint)]"
                    placeholder="Repeat password" />
                </div>
                <button disabled={loading}
                  className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--landing-button)] text-sm font-medium text-[var(--landing-button-text)] transition hover:opacity-90 disabled:opacity-50">
                  {loading ? "Updating..." : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
