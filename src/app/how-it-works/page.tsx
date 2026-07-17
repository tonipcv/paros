import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, EyeOff, LockKeyhole, Server, X } from "lucide-react";
import { ArchitectureFlow } from "@/components/architecture-flow";
import { Reveal } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";

const brandName = "NotOpen";

export const metadata: Metadata = {
  title: "How it works",
  description: `How ${brandName} routes your prompts privately: anonymized routing, zero-retention, TEE enclaves, and end-to-end encryption.`,
  robots: { index: true, follow: true },
};

const tiers = [
  ["01", "Anonymized", "Your identity is stripped before the request is routed. The provider sees a prompt, never who sent it."],
  ["02", "Private", "Zero-retention routes. The provider computes on your prompt and is contractually barred from keeping it."],
  ["03", "TEE enclave", "Inference runs inside a hardware-isolated enclave. Attestation is verified before any prompt is accepted."],
  ["04", "End-to-end encrypted", "Prompts are encrypted on your device to an attested enclave key. We relay ciphertext only. We cannot read it."],
];

const pillars = [
  {
    icon: EyeOff,
    title: "We can't read it",
    caption: "In E2EE mode your prompt is encrypted before it leaves your device. Our servers only ever relay ciphertext.",
  },
  {
    icon: Server,
    title: "We don't keep it",
    caption: "No prompt logs, no response logs, no analytics, no trackers. One session cookie, nothing else.",
  },
  {
    icon: LockKeyhole,
    title: "You hold the key",
    caption: "Encrypted sync is locked with your passphrase. Lose it and the data is unrecoverable, even by us.",
  },
];

const comparison: [string, string, string][] = [
  ["Prompt logging", "Retained 30+ days, tied to your account identity", "Never logged; no content touches our disks"],
  ["Training on your data", "Possible unless you opt out, policy varies by tier", "Never. Technically and contractually excluded"],
  ["Metadata", "Full identity attached to every request", "Stripped before routing"],
  ["Encryption", "TLS only; the provider can read everything", "End-to-end options; we relay ciphertext only"],
  ["Access", "One provider, one key, one bill at a time", "Every frontier model, one key, one workspace"],
];

export default function HowItWorksPage() {
  return (
    <div className="landing-theme min-h-screen">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_38%)]" />
          <Reveal className="mx-auto max-w-[720px] px-5 pb-16 pt-24 text-center sm:pt-32">
            <h1 className="font-display text-[42px] font-medium leading-[1.02] text-[var(--landing-text)] sm:text-[56px]">
              Private by design,<br />not by promise.
            </h1>
            <p className="mx-auto mt-6 max-w-[540px] text-[16px] leading-8 text-[var(--landing-muted)]">
              Most AI tools ask you to trust a policy. {brandName} is built so you don&apos;t have to. Here is exactly what happens to every prompt you send.
            </p>
          </Reveal>
        </section>

        <section>
          <div className="mx-auto max-w-[1080px] px-5 pb-24">
            <ArchitectureFlow />
          </div>
        </section>

        <section className="border-t border-[var(--landing-chip)]">
          <div className="mx-auto max-w-[1080px] px-5 py-24">
            <Reveal className="mx-auto max-w-[640px] text-center">
              <h2 className="font-display text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
                Four levels of privacy. You choose.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-[var(--landing-muted)]">
                Match the protection to the sensitivity of the work, per conversation rather than per account.
              </p>
            </Reveal>
            <div className="mx-auto mt-14 max-w-[760px]">
              {tiers.map(([num, title, desc], index) => (
                <Reveal key={title} delay={index * 0.08}>
                  <div className="flex gap-6 border-t border-[var(--landing-chip)] py-6 last:border-b">
                    <span className="font-display w-10 shrink-0 text-[15px] text-[var(--landing-faint)]">{num}</span>
                    <div>
                      <h3 className="text-[15px] font-semibold text-[var(--landing-text)]">{title}</h3>
                      <p className="mt-1.5 text-[13px] leading-6 text-[var(--landing-muted)]">{desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--landing-chip)]">
          <div className="mx-auto max-w-[1080px] px-5 py-24">
            <Reveal className="mx-auto max-w-[640px] text-center">
              <h2 className="font-display text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
                Why it stays private
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {pillars.map((pillar, index) => {
                const Icon = pillar.icon;
                return (
                  <Reveal key={pillar.title} delay={index * 0.1}>
                    <div className="h-full rounded-[24px] bg-[var(--landing-card)] p-6 shadow-[var(--landing-card-shadow)]">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--landing-chip)] text-[var(--landing-text)]">
                        <Icon size={16} />
                      </span>
                      <h3 className="mt-5 text-[15px] font-semibold text-[var(--landing-text)]">{pillar.title}</h3>
                      <p className="mt-2 text-[13px] leading-6 text-[var(--landing-muted)]">{pillar.caption}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--landing-chip)]">
          <div className="mx-auto max-w-[900px] px-5 py-24">
            <Reveal className="mx-auto max-w-[640px] text-center">
              <h2 className="font-display text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
                {brandName} vs. calling model APIs directly
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-[var(--landing-muted)]">
                Going straight to a closed provider means every prompt arrives with your name on it.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-12 overflow-hidden rounded-[24px] bg-[var(--landing-card)] shadow-[var(--landing-card-shadow)]">
                <div className="grid grid-cols-[1fr_1.2fr_1.2fr] gap-4 border-b border-[var(--landing-chip)] px-5 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--landing-faint)] sm:px-7">
                  <span />
                  <span>Their API</span>
                  <span className="text-[var(--landing-text)]">{brandName}</span>
                </div>
                {comparison.map(([label, theirs, ours]) => (
                  <div key={label} className="grid grid-cols-[1fr_1.2fr_1.2fr] gap-4 border-b border-[var(--landing-chip)] px-5 py-4 last:border-b-0 sm:px-7">
                    <span className="text-[12px] font-medium text-[var(--landing-body)]">{label}</span>
                    <span className="flex gap-2 text-[12px] leading-5 text-[var(--landing-faint)]">
                      <X size={13} className="mt-0.5 shrink-0" />
                      {theirs}
                    </span>
                    <span className="flex gap-2 text-[12px] leading-5 text-[var(--landing-body)]">
                      <Check size={13} className="mt-0.5 shrink-0 text-[var(--landing-text)]" />
                      {ours}
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-[var(--landing-chip)]">
          <Reveal className="mx-auto max-w-[1080px] px-5 py-24 text-center">
            <h2 className="font-display text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
              Start creating privately.
            </h2>
            <div className="mt-8 flex items-center justify-center gap-6">
              <Link href="/signup" className="rounded-lg bg-[var(--landing-button)] px-5 py-3 text-[13px] font-medium text-[var(--landing-button-text)] transition hover:opacity-90">
                Get started free
              </Link>
              <Link href="/privacy" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--landing-text)] hover:underline">
                Read the privacy policy <ArrowRight size={14} />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[var(--landing-chip)]">
        <div className="mx-auto flex max-w-[1080px] flex-col items-center justify-between gap-4 px-5 py-8 text-[13px] text-[var(--landing-faint)] sm:flex-row">
          <span>© {new Date().getFullYear()} {brandName}</span>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="transition hover:text-[var(--landing-text)]">Privacy</Link>
            <Link href="/terms" className="transition hover:text-[var(--landing-text)]">Terms</Link>
            <Link href="/docs" className="transition hover:text-[var(--landing-text)]">Docs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
