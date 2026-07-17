"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const appName = "NotOpen";

export const authInputClass =
  "h-11 w-full rounded-lg bg-[var(--landing-field)] px-3 text-sm text-[var(--landing-text)] outline-none placeholder:text-[var(--landing-faint)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:ring-1 focus:ring-[var(--landing-faint)]";

export const authButtonClass =
  "flex h-11 w-full items-center justify-center rounded-lg bg-[var(--landing-button)] text-sm font-medium text-[var(--landing-button-text)] transition hover:opacity-90 disabled:opacity-50";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="landing-theme grid min-h-screen place-items-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="w-full max-w-[400px]"
      >
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={appName} className="h-7 w-7 rounded-lg" />
          <span className="font-display text-[22px] font-medium leading-none tracking-[0.01em] text-[var(--landing-text)]">{appName}</span>
        </Link>

        <div className="rounded-[24px] bg-[var(--landing-card)] p-6 shadow-[var(--landing-card-shadow)] sm:p-8">
          <h1 className="font-display text-[26px] font-medium leading-tight text-[var(--landing-text)]">{title}</h1>
          {subtitle ? <p className="mb-6 mt-1.5 text-sm text-[var(--landing-faint)]">{subtitle}</p> : <div className="mb-6" />}
          {children}
        </div>

        {footer ? <div className="mt-6 text-center text-xs text-[var(--landing-faint)]">{footer}</div> : null}
      </motion.div>
    </div>
  );
}

export function GoogleButton() {
  return (
    <a
      href="/api/auth/google"
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--landing-chip)] text-sm font-medium text-[var(--landing-body)] transition hover:text-[var(--landing-text)]"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Continue with Google
    </a>
  );
}

export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-[var(--landing-chip)]" />
      <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--landing-faint)]">or</span>
      <div className="h-px flex-1 bg-[var(--landing-chip)]" />
    </div>
  );
}

export function AuthField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[var(--landing-faint)]" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}
