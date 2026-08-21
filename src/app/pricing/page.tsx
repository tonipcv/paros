import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { LandingPricing } from "@/components/landing-pricing";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "KRX pricing: private AI chat, image generation, and OpenAI-compatible API access. Pro from $18/mo, cancel anytime.",
};

const faqs = [
  {
    q: "How does the credits system work?",
    a: "Every plan includes a monthly credit allowance (1 credit ≈ $0.015 of inference cost). Chats, images, voice, and API calls consume credits based on the model used. Unused Pro+ and Max credits bank for up to 2 months.",
  },
  {
    q: "What is the difference between the privacy modes?",
    a: "Anonymous routes with hidden identity, Private routes with zero-retention providers, TEE runs prompts inside an attested enclave, and E2EE encrypts prompts in your browser so our servers never see them. TEE and E2EE fail closed if attestation fails.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the billing portal and you keep access until the end of the billing period. No contracts, no fees.",
  },
  {
    q: "Is there an API included?",
    a: "Yes. Every paid plan includes an OpenAI-compatible API (/api/v1) with rate limits scaled to your plan. Pro+ and Max get higher throughput and priority routing.",
  },
  {
    q: "What models can I use?",
    a: "Hundreds of models via our catalog: Llama, Claude, DeepSeek, GPT, Qwen, Gemini, Grok and more, plus image, voice and embedding models.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept major credit and debit cards via Stripe. Billing is handled securely by Stripe; we never store your card details.",
  },
];

function compareRows() {
  return [
    { label: "Uncensored / no refusals", krx: true, venice: true, chatgpt: false },
    { label: "Multiple frontier models", krx: true, venice: true, chatgpt: false },
    { label: "Local-first storage (IndexedDB)", krx: true, venice: true, chatgpt: false },
    { label: "TEE attested enclaves", krx: true, venice: false, chatgpt: false },
    { label: "True E2EE (server never sees prompts)", krx: true, venice: false, chatgpt: false },
    { label: "OpenAI-compatible API included", krx: true, venice: false, chatgpt: false },
    { label: "Pricing", krx: "From $18/mo", venice: "From $20/mo", chatgpt: "From $20/mo" },
  ];
}

export default function PricingPage() {
  return (
    <div className="landing-theme min-h-screen">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.10),transparent_38%)]" />
          <div className="mx-auto max-w-[1080px] px-5 pb-10 pt-20 sm:pt-28">
            <h1 className="font-display text-center text-[40px] font-medium leading-[1.05] text-[var(--landing-text)] sm:text-[54px]">
              Simple pricing.
              <br />
              Serious privacy.
            </h1>
            <p className="mx-auto mt-5 max-w-[560px] text-center text-[16px] leading-8 text-[var(--landing-muted)]">
              Start free, upgrade when you are ready. Every plan includes private chat, image generation, and API access.
            </p>
          </div>
        </section>

        <LandingPricing />

        <section className="border-t border-[var(--landing-chip)]">
          <div className="mx-auto max-w-[1080px] px-5 py-24">
            <h2 className="font-display text-center text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
              KRX vs the alternatives
            </h2>
            <p className="mx-auto mt-4 max-w-[560px] text-center text-[15px] leading-7 text-[var(--landing-muted)]">
              Built for people who need frontier models without the surveillance, censorship, or lock-in.
            </p>

            <div className="mt-12 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[var(--landing-chip)]">
                    <th className="py-4 pr-4 font-medium text-[var(--landing-muted)]">Capability</th>
                    <th className="px-4 py-4 font-semibold text-[var(--landing-text)]">KRX</th>
                    <th className="px-4 py-4 font-medium text-[var(--landing-faint)]">Venice AI</th>
                    <th className="px-4 py-4 font-medium text-[var(--landing-faint)]">ChatGPT Plus</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows().map((row) => (
                    <tr key={row.label} className="border-b border-[var(--landing-chip)]/60">
                      <td className="py-4 pr-4 text-[var(--landing-body)]">{row.label}</td>
                      {[row.krx, row.venice, row.chatgpt].map((value, i) => (
                        <td key={i} className="px-4 py-4 text-[var(--landing-body)]">
                          {typeof value === "boolean" ? (
                            value ? <Check size={16} className="text-[var(--landing-text)]" /> : <span className="text-[var(--landing-faint)]">—</span>
                          ) : (
                            <span className={i === 0 ? "font-medium text-[var(--landing-text)]" : "text-[var(--landing-faint)]"}>{value}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--landing-button)] px-5 py-3 text-[13px] font-medium text-[var(--landing-button-text)] transition hover:opacity-90"
              >
                Get started free <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-[var(--landing-chip)]">
          <div className="mx-auto max-w-[760px] px-5 py-24">
            <h2 className="font-display text-center text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
              Frequently asked questions
            </h2>
            <div className="mt-10 space-y-3">
              {faqs.map((faq) => (
                <details key={faq.q} className="group rounded-[18px] bg-[var(--landing-card)] p-5 shadow-[var(--landing-card-shadow)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-[var(--landing-text)]">
                    {faq.q}
                    <span className="shrink-0 text-[var(--landing-faint)] transition-transform duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[14px] leading-7 text-[var(--landing-muted)]">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--landing-chip)]">
          <div className="mx-auto max-w-[1080px] px-5 py-20 text-center">
            <h2 className="font-display text-[28px] font-medium leading-[1.08] text-[var(--landing-text)] sm:text-[36px]">
              Try it free. No card required.
            </h2>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-[var(--landing-button)] px-5 py-3 text-[13px] font-medium text-[var(--landing-button-text)] transition hover:opacity-90"
              >
                Create free account
              </Link>
              <Link href="/how-it-works" className="rounded-lg px-5 py-3 text-[13px] font-medium text-[var(--landing-text)] transition hover:opacity-90">
                How privacy works
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--landing-chip)]">
        <div className="mx-auto flex max-w-[1080px] flex-col items-center justify-between gap-4 px-5 py-8 text-[13px] text-[var(--landing-faint)] sm:flex-row">
          <span>© {new Date().getFullYear()} KRX</span>
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
