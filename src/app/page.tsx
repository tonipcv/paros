import Link from "next/link";
import { ArrowRight, Flame, ShieldClose, Sparkles } from "lucide-react";
import { LandingChatPrompt } from "@/components/landing-chat-prompt";
import { LandingPricing } from "@/components/landing-pricing";
import { Reveal } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";

const brandName = "NotOpen";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012";

const faviconUrl = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const models = [
  { name: "Claude", domain: "anthropic.com" },
  { name: "GPT", domain: "openai.com" },
  { name: "Gemini", domain: "google.com" },
  { name: "DeepSeek", domain: "deepseek.com" },
  { name: "Mistral", domain: "mistral.ai" },
  { name: "Llama", domain: "meta.com" },
  { name: "Qwen", domain: "qwen.ai" },
  { name: "Grok", domain: "x.ai" },
];
const privacyTiers = ["Anonymized", "Private", "TEE", "End-to-end encrypted"];

const uncensoredFeatures = [
  { icon: Flame, title: "No refusals", desc: "Models answer what you ask. No paternalistic 'I can't help with that' responses blocking your work." },
  { icon: ShieldClose, title: "Unfiltered creativity", desc: "Write, roleplay, and brainstorm without a corporate policy second-guessing your intent." },
  { icon: Sparkles, title: "Self-hosted freedom", desc: "Uncensored models run on our infrastructure. No third-party filters between you and the model." },
];

export default function LandingPage() {
  return (
    <div className="landing-theme min-h-screen">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_38%)]" />
          <div className="mx-auto max-w-[1080px] px-5 pb-24 pt-24 sm:pt-32">
            <Reveal className="mx-auto max-w-[720px] text-center">
              <h1 className="font-display text-[48px] font-medium leading-[1.02] text-[var(--landing-text)] sm:text-[64px]">
                Ask anything.
              </h1>
              <p className="mx-auto mt-6 max-w-[520px] text-[17px] leading-8 text-[var(--landing-muted)]">
                Every frontier model, one private workspace. No filters, no refusals, no BS.
              </p>
            </Reveal>

            <Reveal delay={0.12}>
              <LandingChatPrompt />
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-14 flex flex-wrap items-center justify-center gap-x-9 gap-y-4">
                {models.map((model) => (
                  <div
                    key={model.name}
                    className="landing-model flex cursor-default items-center gap-2 text-[13px] text-[var(--landing-faint)] transition-colors duration-300 hover:text-[var(--landing-text)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={faviconUrl(model.domain)}
                      alt=""
                      className="landing-model-logo h-4 w-4"
                      loading="lazy"
                    />
                    <span>{model.name}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="privacy" className="border-t border-[var(--landing-chip)]">
          <div className="mx-auto max-w-[1080px] px-5 py-24">
            <Reveal className="mx-auto max-w-[640px] text-center">
              <h2 className="font-display text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
                The product is privacy.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-[var(--landing-muted)]">
                Choose the level that matches the work, from anonymized routing to end-to-end encryption.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                {privacyTiers.map((tier) => (
                  <span key={tier} className="rounded-full bg-[var(--landing-chip)] px-3.5 py-1.5 text-[12px] text-[var(--landing-body)]">
                    {tier}
                  </span>
                ))}
              </div>
              <Link href="/how-it-works" className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--landing-text)] hover:underline">
                How it works <ArrowRight size={14} />
              </Link>
            </Reveal>
          </div>
        </section>

        <section id="uncensored" className="border-t border-[var(--landing-chip)]">
          <div className="mx-auto max-w-[1080px] px-5 py-24">
            <Reveal className="mx-auto max-w-[640px] text-center">
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-[11px] font-medium text-orange-500">
                <Flame size={12} /> Uncensored
              </div>
              <h2 className="font-display text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
                No filters. No refusals. No BS.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-[var(--landing-muted)]">
                Most AI platforms treat you like a child. We don't. Ask what you want, create what you need — the model answers or it doesn't, but the decision is the model's, not a corporate content policy.
              </p>
            </Reveal>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {uncensoredFeatures.map(({ icon: Icon, title, desc }, i) => (
                <Reveal key={title} delay={i * 0.1}>
                  <div className="h-full rounded-[24px] bg-[var(--landing-card)] p-6 shadow-[var(--landing-card-shadow)]">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-orange-500/10 text-orange-500">
                      <Icon size={16} />
                    </span>
                    <h3 className="mt-5 text-[15px] font-semibold text-[var(--landing-text)]">{title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-[var(--landing-muted)]">{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <LandingPricing />

        <section id="api" className="border-t border-[var(--landing-chip)]">
          <div className="mx-auto grid max-w-[1080px] items-center gap-10 px-5 py-24 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <h2 className="font-display max-w-[480px] text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
                One endpoint. Every model.
              </h2>
              <p className="mt-5 max-w-[480px] text-[15px] leading-7 text-[var(--landing-muted)]">
                OpenAI-compatible API with the same privacy posture as the workspace.
              </p>
              <Link href="/docs" className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--landing-text)] hover:underline">
                Read the docs <ArrowRight size={14} />
              </Link>
            </Reveal>
            <Reveal delay={0.1}>
              <pre className="overflow-x-auto rounded-[18px] bg-black p-5 text-[12px] leading-6 text-[#cfcfcf] shadow-[var(--landing-card-shadow)]">
{`const client = new OpenAI({
  apiKey: process.env.NOTOPEN_API_KEY,
  baseURL: "${appUrl}/api/v1"
});

await client.chat.completions.create({
  model: "notopen-auto",
  messages
});`}
              </pre>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-[var(--landing-chip)]">
          <Reveal className="mx-auto max-w-[1080px] px-5 py-24 text-center">
            <h2 className="font-display text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
              Start creating privately.
            </h2>
            <div className="mt-8 flex justify-center">
              <Link href="/signup" className="rounded-lg bg-[var(--landing-button)] px-5 py-3 text-[13px] font-medium text-[var(--landing-button-text)] transition hover:opacity-90">
                Get started free
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
