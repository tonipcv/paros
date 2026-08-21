import type { Metadata } from "next";

const appName = "KRX";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms and conditions for using ${appName}.`,
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="landing-theme min-h-screen">
      <div className="mx-auto max-w-[780px] px-5 py-12 sm:px-6">
        <h1 className="font-display text-[36px] font-medium leading-tight text-[var(--landing-text)]">Terms of Service</h1>
        <p className="mb-10 mt-2 text-sm text-[var(--landing-faint)]">Last updated: July 2026</p>
        <div className="prose prose-sm max-w-none space-y-6 text-[var(--landing-body)] [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--landing-text)] [&_h2]:mt-10 [&_p]:text-[15px] [&_p]:leading-relaxed">
          <TermsContent />
        </div>
      </div>
    </div>
  );
}

function TermsContent() {
  const name = appName;
  return (
    <>
      <h2>1. Acceptance of Terms</h2>
      <p>
        By creating an account or accessing the {name} platform (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Service.
      </p>
      <h2>2. Description of Service</h2>
      <p>
        {name} provides a privacy-first AI workspace for chat, image generation, audio processing, and API access. Features and models may change without prior notice.
      </p>
      <h2>3. Account Responsibilities</h2>
      <p>
        You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. You must provide accurate registration information, including a valid email address. {name} reserves the right to suspend or terminate accounts that violate these terms.
      </p>
      <h2>4. Acceptable Use</h2>
      <p>
        You agree not to use the Service for any unlawful purpose or in violation of any applicable laws or regulations. Prohibited uses include but are not limited to: generating illegal content, harassing or abusing others, violating intellectual property rights, attempting to circumvent usage limits or security measures, and using the Service to distribute malware or conduct denial-of-service attacks.
      </p>
      <h2>5. Privacy and Data</h2>
      <p>
        Your privacy is central to {name}. By default, conversations are stored locally on your device. When using encrypted cloud sync, only ciphertext is stored on our servers. We do not use your prompts or generated content to train models. See our <a href="/privacy" className="text-[var(--landing-text)] underline">Privacy Policy</a> for details.
      </p>
      <h2>6. Billing and Credits</h2>
      <p>
        Paid plans are billed through Stripe. Credits are consumed based on the model and usage type selected. Credits expire at the end of each billing period unless your plan includes rollover. You may cancel at any time; cancellation takes effect at the end of the current billing period. Refunds are at our sole discretion.
      </p>
      <h2>7. Intellectual Property</h2>
      <p>
        The {name} platform, its code, branding, and design are proprietary. You retain ownership of content you generate through the Service. By using the Service, you grant {name} a limited license to process your content solely to provide the Service.
      </p>
      <h2>8. Third-Party Services</h2>
      <p>
        The Service integrates with third-party providers for model inference, payment processing, and infrastructure. {name} is not responsible for the availability or practices of those providers. Use of certain features may be subject to additional terms from those providers.
      </p>
      <h2>9. Limitation of Liability</h2>
      <p>
        The Service is provided &quot;as is&quot; without warranties of any kind. {name} shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability in any matter shall not exceed the amount you paid us in the preceding 12 months.
      </p>
      <h2>10. Changes to Terms</h2>
      <p>
        We may update these terms from time to time. Material changes will be communicated via email or in-app notice. Continued use after changes become effective constitutes acceptance.
      </p>
      <h2>11. Contact</h2>
      <p>
        For questions about these terms, contact <a href="mailto:krx@heuv.dev" className="text-[var(--landing-text)] underline">krx@heuv.dev</a>.
      </p>
    </>
  );
}
