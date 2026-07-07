"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "krx_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
    } catch {
      // Storage unavailable (private mode / blocked) — don't nag.
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-4">
      <div className="card flex w-full max-w-2xl flex-col items-start gap-3 p-4 shadow-lg sm:flex-row sm:items-center sm:gap-4">
        <p className="flex-1 text-[13px] leading-relaxed text-muted">
          We only use a single essential cookie to keep you signed in. No tracking, no
          analytics, no ads.{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            Privacy
          </Link>
          .
        </p>
        <button onClick={accept} className="btn-primary w-full shrink-0 sm:w-auto">
          Got it
        </button>
      </div>
    </div>
  );
}
