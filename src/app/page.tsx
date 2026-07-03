import Link from "next/link";
import { MessageSquare, Image as ImageIcon, ShieldCheck, Code2, Zap, Lock } from "lucide-react";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Nebula AI";

const features = [
  { icon: MessageSquare, title: "Multi-model chat", desc: "Llama, Claude, DeepSeek, Qwen, GPT and uncensored models in one place." },
  { icon: ImageIcon, title: "Image generation", desc: "Text-to-image with 8+ styles. Photorealistic, anime, cinematic and more." },
  { icon: ShieldCheck, title: "Privacy-first", desc: "Your conversations are yours. No training on your data, ever." },
  { icon: Code2, title: "OpenAI-compatible API", desc: "Drop-in API keys. Point your existing SDK at our endpoint." },
  { icon: Zap, title: "Fast inference", desc: "Low-latency streaming responses across every supported model." },
  { icon: Lock, title: "Uncensored access", desc: "Unfiltered models available for research and creative freedom." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-silver">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={appName} className="h-8 w-8 rounded-btn" />
          <span className="text-[15px] font-semibold text-grad-light">{appName}</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn-primary">Get started</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-5 pb-16 pt-20 text-center">
        <span className="muted-pill mx-auto mb-6">Private · Uncensored · Multi-model</span>
        <h1 className="text-balance text-4xl font-semibold leading-[1.1] text-grad-light sm:text-6xl">
          The private gateway to generative AI
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted sm:text-lg">
          Chat with 200+ models and generate images without surveillance. {appName} keeps your
          prompts private and gives you an OpenAI-compatible API.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary h-11 px-6 text-sm">Start free</Link>
          <Link href="/login" className="btn-secondary h-11 px-6 text-sm">Sign in</Link>
        </div>
        <p className="mt-4 text-xs text-tertiary">500 free credits · No credit card required</p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card p-6">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg border border-borderDefault bg-bg text-silver">
                  <Icon size={20} />
                </div>
                <h3 className="text-h3 text-grad-light">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-borderDefault">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-xs text-tertiary">
          <span>© {new Date().getFullYear()} {appName}</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-primary">Sign in</Link>
            <Link href="/signup" className="hover:text-primary">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
