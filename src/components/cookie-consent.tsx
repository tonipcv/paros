"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const CONSENT_KEY = "notopen_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
    } catch {
      // Storage unavailable (private mode / blocked) — don't nag.
    }
  }, []);

  function decide(choice: "all" | "necessary") {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, at: Date.now() }));
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:justify-start sm:p-0"
    >
      <div className="card w-full max-w-md p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-highlight/10 text-primary">
            <ShieldCheck size={16} />
          </span>
          <h2 id="cookie-title" className="text-[14px] font-semibold text-primary">
            Your privacy
          </h2>
        </div>

        <p className="text-[13px] leading-relaxed text-muted">
          We use a single strictly necessary cookie to keep your session secure. We do not use
          analytics, advertising, or third-party tracking cookies. See our{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button onClick={() => decide("necessary")} className="btn-secondary w-full sm:w-auto">
            Necessary only
          </button>
          <button onClick={() => decide("all")} className="btn-primary w-full sm:w-auto">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
