import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { LandingChatPrompt } from "@/components/landing-chat-prompt";
import { LandingPricing } from "@/components/landing-pricing";
import { Reveal } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";

const brandName = "KRX";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012";

const compareRows = [
  { label: "Uncensored / no refusals", krx: true, venice: true, chatgpt: false },
  { label: "Multiple frontier models", krx: true, venice: true, chatgpt: false },
  { label: "Local-first storage (IndexedDB)", krx: true, venice: true, chatgpt: false },
  { label: "TEE attested enclaves", krx: true, venice: false, chatgpt: false },
  { label: "True E2EE (server never sees prompts)", krx: true, venice: false, chatgpt: false },
  { label: "OpenAI-compatible API included", krx: true, venice: false, chatgpt: false },
  { label: "Pricing", krx: "From $18/mo", venice: "From $20/mo", chatgpt: "From $20/mo" },
];

const faqs = [
  {
    q: "How does the credits system work?",
    a: "Every plan includes a monthly credit allowance (1 credit ≈ $0.015 of inference cost). Chats, images, voice, and API calls consume credits based on the model used. Unused Pro+ and Max credits bank for up to 2 months.",
  },
  {
    q: "Is KRX really uncensored?",
    a: "Yes — we route through providers and models without refusal policies. We keep only the abuse filters required to operate (spam, malware, illegal content) and never silently downgrade requests.",
  },
  {
    q: "Can you read my conversations?",
    a: "In Private, TEE, and E2EE modes, no. Private uses zero-retention providers, TEE runs in attested enclaves, and E2EE encrypts prompts in your browser before they leave. Only Anonymous mode allows providers to retain data, by design.",
  },
  {
    q: "What models are available?",
    a: "Hundreds through our catalog: Llama, Claude, DeepSeek, GPT, Qwen, Gemini, Grok and more, plus image, voice, and embedding models.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the billing portal and keep access until the end of the billing period. No contracts, no fees.",
  },
];

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

export default function LandingPage() {
  return (
    <div className="landing-theme landing-theme-light min-h-screen">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(circle_at_50%_0%,rgba(17,17,17,0.07),transparent_38%)]" />
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

        <section id="compare" className="border-t border-[var(--landing-chip)]">
          <div className="mx-auto max-w-[1080px] px-5 py-24">
            <Reveal className="mx-auto max-w-[640px] text-center">
              <h2 className="font-display text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
                The private alternative to Venice and ChatGPT
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-[var(--landing-muted)]">
                Frontier models without the filters — and with privacy guarantees the mainstream apps don&apos;t offer.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
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
                    {compareRows.map((row) => (
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
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-10 text-center">
                <Link href="/pricing" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--landing-text)] hover:underline">
                  See full pricing comparison <ArrowRight size={14} />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        <LandingPricing />

        <section id="faq" className="border-t border-[var(--landing-chip)]">
          <div className="mx-auto max-w-[760px] px-5 py-24">
            <Reveal className="text-center">
              <h2 className="font-display text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
                Frequently asked questions
              </h2>
            </Reveal>
            <div className="mt-10 space-y-3">
              {faqs.map((faq, i) => (
                <Reveal key={faq.q} delay={i * 0.04}>
                  <details className="group rounded-[18px] bg-[var(--landing-card)] p-5 shadow-[var(--landing-card-shadow)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-[var(--landing-text)]">
                      {faq.q}
                      <span className="shrink-0 text-[var(--landing-faint)] transition-transform duration-200 group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-3 text-[14px] leading-7 text-[var(--landing-muted)]">{faq.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

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
  apiKey: process.env.KRX_API_KEY,
  baseURL: "${appUrl}/api/v1"
});

await client.chat.completions.create({
  model: "krx-auto",
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
