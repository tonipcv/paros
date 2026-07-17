"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const brandName = "NotOpen";

const navLinks = [
  { href: "/#privacy", label: "Privacy" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#api", label: "API" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "border-b border-[var(--landing-chip)] bg-[var(--landing-bg)]/70 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div
        className={`mx-auto flex max-w-[1080px] items-center justify-between px-5 transition-all duration-300 ${
          scrolled ? "h-[54px]" : "h-[68px]"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={brandName}
            className={`rounded-lg transition-all duration-300 ${scrolled ? "h-6 w-6" : "h-7 w-7"}`}
          />
          <span
            className={`font-display font-medium leading-none tracking-[0.01em] text-[var(--landing-text)] transition-all duration-300 ${
              scrolled ? "text-[18px]" : "text-[21px]"
            }`}
          >
            {brandName}
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-[13px] text-[var(--landing-faint)] md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-[var(--landing-text)]">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-lg px-3 py-2 text-[13px] text-[var(--landing-body)] transition hover:text-[var(--landing-text)]">
            Log in
          </Link>
          <Link href="/signup" className="rounded-lg bg-[var(--landing-button)] px-4 py-2 text-[13px] font-medium text-[var(--landing-button-text)] transition hover:opacity-90">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
