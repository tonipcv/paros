"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const appName = "NotOpen";

export default function VerifyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"success" | "invalid" | "pending">("pending");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    setStatus(s === "success" ? "success" : s === "invalid" ? "invalid" : "pending");
  }, []);

  async function resend() {
    setResending(true);
    const res = await fetch("/api/email/resend", { method: "POST" });
    setResending(false);
    if (res.ok) toast.success("Verification email sent — check your inbox.");
    else if (res.status === 401) {
      toast.error("Please sign in first, then we&apos;ll resend the verification email.");
      setTimeout(() => router.replace("/login"), 1500);
    }
    else toast.error("Could not resend right now.");
  }

  const title =
    status === "success" ? "Email verified" : status === "invalid" ? "Link invalid or expired" : "Verify your email";
  const message =
    status === "success"
      ? "Your email address has been confirmed. Your account is now fully verified."
      : status === "invalid"
        ? "This verification link is invalid or has expired. Request a new one below."
        : "Check your inbox for a verification link. If you can't find it, you can request a new one.";

  return (
    <div className="landing-theme min-h-screen px-5 py-8">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={appName} className="h-8 w-8 rounded-lg" />
          <span className="text-[15px] font-semibold tracking-[0.08em] text-[var(--landing-text)]">{appName}</span>
        </Link>
        <Link href="/chat" className="rounded-lg bg-[var(--landing-chip)] px-4 py-2 text-[13px] font-medium text-[var(--landing-text)] transition hover:opacity-80">
          Open NotOpen
        </Link>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-96px)] max-w-[480px] items-center py-12">
        <div className="w-full rounded-[28px] bg-[var(--landing-card)] p-5 shadow-[var(--landing-card-shadow)] sm:p-7">
          <h2 className="font-display text-[32px] font-medium leading-tight text-[var(--landing-text)]">{title}</h2>
          <p className="mb-7 mt-2 text-sm text-[var(--landing-faint)]">{message}</p>

          {status === "success" ? (
            <Link href="/chat" className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--landing-button)] text-sm font-medium text-[var(--landing-button-text)] transition hover:opacity-90">
              Continue to NotOpen
            </Link>
          ) : (
            <button onClick={resend} disabled={resending}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--landing-button)] text-sm font-medium text-[var(--landing-button-text)] transition hover:opacity-90 disabled:opacity-50">
              {resending ? "Sending..." : "Resend verification email"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
