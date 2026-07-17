import type { Metadata } from "next";

const appName = "NotOpen";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${appName} handles your data — zero-retention routing, TEE enclaves, end-to-end encryption, and local-first storage.`,
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="landing-theme min-h-screen">
      <div className="mx-auto max-w-[780px] px-5 py-12 sm:px-6">
        <h1 className="font-display text-[36px] font-medium leading-tight text-[var(--landing-text)]">Privacy Policy</h1>
        <p className="mb-10 mt-2 text-sm text-[var(--landing-faint)]">Last updated: July 2026</p>
        <div className="prose prose-sm max-w-none space-y-6 text-[var(--landing-body)] [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--landing-text)] [&_h2]:mt-10 [&_p]:text-[15px] [&_p]:leading-relaxed [&_li]:text-[14px] [&_li]:leading-relaxed">
          <PrivacyContent />
        </div>
      </div>
    </div>
  );
}

function PrivacyContent() {
  const name = appName;
  return (
    <>
      <h2>1. Our Approach</h2>
      <p>
        {name} is a privacy-first AI workspace. We believe your work should remain yours. This policy explains what data we collect, how we use it, and — most importantly — what we <strong>don&apos;t</strong> see or store.
      </p>
      <h2>2. What We Collect</h2>
      <p>We collect only the minimum information necessary to operate the Service:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Account information:</strong> email address, name, and a hashed password for email/password accounts. Google OAuth users share only their name and email.</li>
        <li><strong>Usage metadata:</strong> credit consumption events (which model was used, when, and how many credits). We do <strong>not</strong> log your prompts or generated responses server-side.</li>
        <li><strong>Billing information:</strong> managed entirely by Stripe. {name} does not handle or store credit card numbers or payment details.</li>
        <li><strong>Session cookies:</strong> a single essential cookie to keep you signed in. No tracking, analytics, or advertising cookies are ever used.</li>
      </ul>
      <h2>3. What We Never See or Store</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Anonymous mode:</strong> your prompts are proxied to inference providers without account-level logging.</li>
        <li><strong>Private mode:</strong> prompts are routed with a contractual zero-retention requirement.</li>
        <li><strong>TEE mode:</strong> prompts run inside a hardware-isolated TEE enclave whose attestation is verified before any prompt is accepted.</li>
        <li><strong>E2EE mode:</strong> prompts are encrypted on your device to an attested secp256k1 enclave public key. Our server only relays ciphertext — it cannot read your prompts or the model&apos;s reply.</li>
        <li><strong>Encrypted cloud sync:</strong> when enabled, conversations and attachments are encrypted with your passphrase on your device before upload. We store only ciphertext. If you lose your passphrase, the data is unrecoverable — even by us.</li>
        <li><strong>Local-only mode:</strong> conversations are never sent to our servers at all.</li>
      </ul>
      <h2>4. How We Use Data</h2>
      <p>We use account information to authenticate you and provide the Service. Usage metadata is used for credit accounting and abuse prevention. We never sell your data, and we never use your prompts or generated content to train models.</p>
      <h2>5. Data Retention and Deletion</h2>
      <p>You may delete your account at any time from Settings. This permanently removes your account, workspace, and all associated data. Guest sessions are pruned after 7 days of inactivity.</p>
      <h2>6. Subprocessors</h2>
      <p>{name} relies on the following third-party services:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Cloudflare</strong> — DNS, email sending, Turnstile anti-bot, R2 object storage.</li>
        <li><strong>Vercel</strong> — application hosting.</li>
        <li><strong>Stripe</strong> — payment processing.</li>
        <li><strong>Neon (PostgreSQL)</strong> — database hosting.</li>
        <li><strong>OpenRouter / Phala</strong> — model inference providers, depending on the privacy mode selected.</li>
      </ul>
      <h2>7. Cookies</h2>
      <p>{name} uses one strictly necessary session cookie to keep you authenticated. No analytics, advertising, or tracking cookies are set under any circumstances.</p>
      <h2>8. If You&apos;re Under 13</h2>
      <p>{name} is not intended for children under 13. We do not knowingly collect personal information from children.</p>
      <h2>9. Changes to This Policy</h2>
      <p>We may update this policy from time to time. Material changes will be communicated via email or in-app notice.</p>
      <h2>10. Contact</h2>
      <p>For privacy-related inquiries, contact <a href="mailto:notopen@heuv.dev" className="text-[var(--landing-text)] underline">notopen@heuv.dev</a>.</p>
    </>
  );
}
