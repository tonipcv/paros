import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { LandingChatPrompt } from "@/components/landing-chat-prompt";
import { LandingPricing } from "@/components/landing-pricing";

const brandName = "KRX";

const faviconUrl = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const modelGroups = [
  [
    { name: "Claude", domain: "anthropic.com" },
    { name: "OpenAI", domain: "openai.com" },
    { name: "Google", domain: "google.com" },
    { name: "DeepSeek", domain: "deepseek.com" },
    { name: "Mistral", domain: "mistral.ai" },
    { name: "Meta", domain: "meta.com" },
    { name: "Qwen", domain: "qwen.ai" },
    { name: "Grok", domain: "x.ai" },
    { name: "Kimi", domain: "kimi.moonshot.cn" },
    { name: "NVIDIA", domain: "nvidia.com" },
  ],
  [
    { name: "ElevenLabs", domain: "elevenlabs.io" },
    { name: "Runway", domain: "runwayml.com" },
    { name: "Kling", domain: "klingai.com" },
    { name: "Flux", domain: "blackforestlabs.ai" },
    { name: "MiniMax", domain: "minimax.io" },
    { name: "Gemma", domain: "ai.google.dev" },
    { name: "PixVerse", domain: "pixverse.ai" },
    { name: "Vidu", domain: "vidu.com" },
    { name: "Arcee", domain: "arcee.ai" },
    { name: "GLM", domain: "z.ai" },
  ],
];

const privacyProof = [
  ["No training", "Prompts are not used to train models."],
  ["No profiling", "No behavioral profile built from your work."],
  ["Local history", "Keep conversations on your device by default."],
  ["Private routing", "Anonymized and zero-retention paths."],
];

const privacyTiers = [
  ["Tier 1", "Anonymized", "Identifying metadata is stripped before requests are sent to external model providers."],
  ["Tier 2", "Private", "Zero-retention routes for supported models, designed for sensitive conversations."],
  ["Tier 3", "TEE", "Hardware-backed execution paths reduce platform access to private computation."],
  ["Tier 4", "End-to-End Encrypted", "Client-side encryption protects backed-up conversations and long-running work."],
];

export default function LandingPage() {
  return (
    <div className="landing-theme min-h-screen">
      <header className="sticky top-0 z-40 bg-[var(--landing-bg)] backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt={brandName} className="h-8 w-8 rounded-lg" />
            <span className="text-[15px] font-semibold tracking-[0.08em] text-[var(--landing-text)]">{brandName}</span>
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] text-[var(--landing-faint)] md:flex">
            <a href="#about" className="transition hover:text-[var(--landing-text)]">About</a>
            <a href="#features" className="transition hover:text-[var(--landing-text)]">Features</a>
            <a href="#pricing" className="transition hover:text-[var(--landing-text)]">Pricing</a>
            <a href="#api" className="transition hover:text-[var(--landing-text)]">API</a>
            <a href="#privacy" className="transition hover:text-[var(--landing-text)]">Privacy</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 text-[13px] text-[var(--landing-body)] transition hover:text-[var(--landing-text)]">
              Log in
            </Link>
            <Link href="/signup" className="rounded-lg bg-[var(--landing-button)] px-4 py-2 text-[13px] font-medium text-[var(--landing-button-text)] transition hover:opacity-90">
              Log in / Sign up
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section id="about" className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.13),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_42%)]" />
          <div className="mx-auto max-w-[1180px] px-5 pb-20 pt-20 sm:pb-28 sm:pt-28">
            <div className="mx-auto max-w-[760px] text-center">
              <h1 className="font-display text-[44px] font-medium leading-[1] tracking-normal text-[var(--landing-text)] sm:text-[60px]">
                Ask anything
              </h1>
              <p className="mx-auto mt-6 max-w-[610px] text-[17px] leading-8 text-[var(--landing-muted)]">
                Access leading AI models for text, image, video, audio, code, and agents with privacy-first routing.
              </p>
            </div>

            <LandingChatPrompt />

            <div className="mt-16 text-center">
              <p className="text-[13px] font-medium text-[var(--landing-text)]">Access leading AI models with your privacy in mind</p>
              <p className="mx-auto mt-3 max-w-[700px] text-[14px] leading-6 text-[var(--landing-faint)]">
                Fully private or anonymized model access for creation, research, development, and automation.
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-[980px] space-y-3">
              {modelGroups.map((group) => (
                <div key={group.map((model) => model.name).join("-")} className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
                  {group.map((model) => (
                    <div key={model.name} className="flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-xl bg-[var(--landing-chip)] px-3 py-3 text-center text-[12px] text-[var(--landing-body)] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={faviconUrl(model.domain)}
                        alt=""
                        className="landing-model-logo h-6 w-6 opacity-80"
                        loading="lazy"
                      />
                      <span>{model.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="bg-[var(--landing-bg-alt)]">
          <div className="mx-auto max-w-[1180px] px-5 py-24">
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
              <div>
                <p className="text-[13px] text-[var(--landing-faint)]">Privacy first</p>
                <h2 className="font-display mt-3 text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
                  The product is privacy.
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {privacyProof.map(([title, desc]) => (
                  <div key={title} className="rounded-[26px] bg-[var(--landing-card)] p-5 shadow-[var(--landing-card-shadow)]">
                    <p className="text-[15px] font-semibold text-[var(--landing-text)]">{title}</p>
                    <p className="mt-2 text-[13px] leading-6 text-[var(--landing-muted)]">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <LandingPricing />

        <section id="api" className="bg-[var(--landing-bg-alt)]">
          <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-24 lg:grid-cols-[0.92fr_1.08fr]">
            <div>
              <p className="text-[13px] text-[var(--landing-faint)]">Developer API</p>
              <h2 className="font-display mt-3 max-w-[520px] text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
                Private access for builders
              </h2>
              <p className="mt-5 max-w-[520px] text-[15px] leading-7 text-[var(--landing-muted)]">
                OpenAI-compatible endpoints with the same privacy posture as the workspace.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {["OpenAI SDK", "LangChain", "Vercel AI", "CrewAI", "Codex CLI"].map((tool) => (
                  <span key={tool} className="rounded-full bg-[var(--landing-chip)] px-3 py-1.5 text-[12px] text-[var(--landing-muted)]">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-[26px] bg-[var(--landing-card)] p-4 shadow-[var(--landing-card-shadow)]">
              <div className="mb-4 flex items-center gap-2 pb-2">
                {["chat.ts", "image.ts", "video.ts", "audio.ts"].map((tab, index) => (
                  <span key={tab} className={`rounded-lg px-3 py-1.5 text-[12px] ${index === 0 ? "bg-[var(--landing-button)] text-[var(--landing-button-text)]" : "bg-[var(--landing-chip)] text-[var(--landing-faint)]"}`}>
                    {tab}
                  </span>
                ))}
              </div>
              <pre className="overflow-x-auto rounded-[16px] bg-black p-5 text-[12px] leading-6 text-[#cfcfcf]">
{`const client = new OpenAI({
  apiKey: process.env.PRIVATE_AI_KEY,
  baseURL: "https://api.example.com/v1"
});

await client.chat.completions.create({
  model: "private-auto",
  messages,
  tools: ["search", "image", "speech"]
});`}
              </pre>
            </div>
          </div>
        </section>

        <section id="privacy" className="bg-[var(--landing-bg)]">
          <div className="mx-auto max-w-[1180px] px-5 py-24">
            <div className="mx-auto max-w-[720px] text-center">
              <p className="text-[13px] text-[var(--landing-faint)]">Privacy Architecture</p>
              <h2 className="font-display mt-3 text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
                AI that respects your privacy
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-[var(--landing-muted)]">
                Choose the privacy level that matches the work: anonymized, private, enclave-backed, or encrypted.
              </p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {privacyTiers.map(([tier, title, desc]) => (
                <div key={title} className="rounded-[26px] bg-[var(--landing-card)] p-5 shadow-[var(--landing-card-shadow)]">
                  <div className="mb-8 flex items-center justify-between">
                    <span className="text-[12px] text-[var(--landing-faint)]">{tier}</span>
                    {title === "End-to-End Encrypted" ? <LockKeyhole size={17} /> : <ShieldCheck size={17} />}
                  </div>
                  <h3 className="text-[15px] font-semibold text-[var(--landing-text)]">{title}</h3>
                  <p className="mt-3 text-[13px] leading-6 text-[var(--landing-muted)]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[var(--landing-bg-alt)]">
          <div className="mx-auto max-w-[1180px] px-5 py-20 text-center">
            <h2 className="font-display text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">Start creating. Privately.</h2>
            <p className="mx-auto mt-4 max-w-[620px] text-[15px] leading-7 text-[var(--landing-muted)]">
              Private multimodal AI for work that should remain yours.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/signup" className="rounded-lg bg-[var(--landing-button)] px-5 py-3 text-[13px] font-medium text-[var(--landing-button-text)] transition hover:opacity-90">
                Sign Up for Free
              </Link>
              <a href="#pricing" className="rounded-lg bg-[var(--landing-chip)] px-5 py-3 text-[13px] font-medium text-[var(--landing-text)] transition hover:bg-white/[0.1]">
                View Pricing
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[var(--landing-bg)]">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-10 text-[13px] text-[var(--landing-faint)] sm:grid-cols-[1fr_auto_auto]">
          <div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt={brandName} className="h-7 w-7 rounded-lg" />
              <span className="font-semibold tracking-[0.08em] text-[var(--landing-text)]">{brandName}</span>
            </div>
            <p className="mt-4">Private, multimodal AI for everyone.</p>
          </div>
          <div className="grid gap-2">
            <span className="font-medium text-[var(--landing-text)]">Product</span>
            <a href="#features" className="hover:text-[var(--landing-text)]">Features</a>
            <a href="#pricing" className="hover:text-[var(--landing-text)]">Pricing</a>
            <a href="#api" className="hover:text-[var(--landing-text)]">API</a>
          </div>
          <div className="grid gap-2">
            <span className="font-medium text-[var(--landing-text)]">Account</span>
            <Link href="/login" className="hover:text-[var(--landing-text)]">Log in</Link>
            <Link href="/signup" className="hover:text-[var(--landing-text)]">Sign up</Link>
            <Link href="/privacy" className="hover:text-[var(--landing-text)]">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
