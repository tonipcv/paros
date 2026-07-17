"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MailWarning, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

// Shown at the top of the app for signed-in users whose email is not yet
// verified. Guests (guest_*@guest.local) never see it. Dismissible per session.
export function VerifyEmailBanner() {
  const { user } = useAppStore();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  const isGuest = !!user?.email?.endsWith("@guest.local");
  if (!user || user.emailVerified || isGuest || dismissed) return null;

  async function resend() {
    setSending(true);
    const res = await fetch("/api/email/resend", { method: "POST" });
    setSending(false);
    if (res.ok) toast.success("Verification email sent. Check your inbox.");
    else if (res.status === 429) toast.error("Please wait a bit before requesting another email.");
    else toast.error("Could not send right now. Try again later.");
  }

  return (
    <div className="flex items-center gap-3 border-b border-borderDefault bg-highlight/5 px-4 py-2.5 text-[13px]">
      <MailWarning size={16} className="shrink-0 text-tertiary" />
      <p className="min-w-0 flex-1 text-secondary">
        Please verify your email address{user.email ? <span className="text-muted"> ({user.email})</span> : null} to secure your account.
      </p>
      <button
        onClick={resend}
        disabled={sending}
        className="shrink-0 rounded-btn bg-highlight px-3 py-1.5 text-[12px] font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
      >
        {sending ? "Sending..." : "Resend email"}
      </button>
      <button
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-btn text-muted hover:bg-bgHover hover:text-primary"
      >
        <X size={15} />
      </button>
    </div>
  );
}
