import Link from "next/link";

const appName = "KRX";

const tiers = [
  {
    name: "Local-first (default)",
    desc: "Your conversations are stored only in your browser (IndexedDB). Our servers never receive or keep your chat history.",
  },
  {
    name: "Zero-retention inference",
    desc: "Prompts are processed to generate a response and immediately discarded. We route only to model providers configured to not retain or train on data.",
  },
  {
    name: "Encrypted sync",
    desc: "Optionally back up across devices: conversations are encrypted on your device (AES-256-GCM) with a passphrase only you know. We store ciphertext and cannot read it.",
  },
  {
    name: "TEE & decentralized compute (roadmap)",
    desc: "Inference inside Trusted Execution Environments and a distributed GPU network, so no single party can inspect prompts.",
  },
];

const points = [
  "By default, conversation history lives only on your device — never on our servers.",
  "We do not train models on your data.",
  "We do not log prompt or response content, and route to providers with data collection denied.",
  "Encrypted synced conversations are stored as ciphertext (AES-256-GCM); the key never leaves your browser.",
  "Attached documents are parsed in memory for context and are not persisted — only the file name is kept (in encrypted sync).",
  "Temporary chats are not saved anywhere. You can delete your account and all data at any time.",
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg text-silver">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={appName} className="h-8 w-8 rounded-btn" />
          <span className="text-[15px] font-semibold text-grad-light">{appName}</span>
        </Link>
        <Link href="/chat" className="btn-secondary">Open app</Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24">
        <h1 className="text-3xl font-semibold text-grad-light">Privacy & security</h1>
        <p className="mt-2 text-sm text-muted">
          {appName} is built privacy-first. Your prompts are yours. Here is exactly how we handle data.
        </p>

        <section className="mt-8">
          <h2 className="text-h2 text-primary">Our commitments</h2>
          <ul className="mt-3 space-y-2">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-secondary">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-borderHover" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-h2 text-primary">Privacy tiers</h2>
          <div className="mt-3 space-y-3">
            {tiers.map((t, i) => (
              <div key={t.name} className="card p-5">
                <p className="text-[13px] font-semibold text-primary">
                  {i + 1}. {t.name}
                </p>
                <p className="mt-1 text-[13px] text-muted">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-h2 text-primary">Transparency</h2>
          <div className="card mt-3 p-5 text-[13px] text-muted">
            <p>As of {new Date().toISOString().slice(0, 10)}:</p>
            <ul className="mt-2 space-y-1.5">
              <li>— We have not received any government request for user data.</li>
              <li>— We have not been compelled to hand over encryption keys (we do not hold them).</li>
              <li>— We do not have backdoors in our software.</li>
              <li>— Our client is open source and independently verifiable.</li>
            </ul>
            <p className="mt-3 text-tertiary">This canary is reviewed periodically. Absence of this statement in future versions should be treated as a warning.</p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-h2 text-primary">Metadata</h2>
          <p className="mt-2 text-sm text-muted">
            We minimize metadata: we do not log IP addresses against your activity, we send a no-referrer policy,
            enforce a strict Content-Security-Policy, and keep sessions scoped to your device.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-h2 text-primary">Inference</h2>
          <p className="mt-2 text-sm text-muted">
            Prompts are forwarded to model providers only to generate a response, then discarded. We disable
            content logging on our servers. For maximum privacy, enable end-to-end encryption in Settings or
            use Privacy Mode in chat.
          </p>
        </section>
      </main>
    </div>
  );
}
