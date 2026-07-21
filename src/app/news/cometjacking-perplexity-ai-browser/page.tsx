import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const brandName = "NotOpen";

export const metadata: Metadata = {
 title: "CometJacking: One Click Can Turn Perplexity's AI Browser Against You",
 description:
 "LayerX research reveals a critical vulnerability in Perplexity's Comet AI browser where a single malicious URL can hijack the assistant and steal emails, calendar data, and more.",
 robots: { index: true, follow: true },
};

export default function NewsArticlePage() {
 return (
 <div
  className="landing-theme news min-h-screen"
 >
  <SiteHeader />

  <main>
  <article className="mx-auto max-w-[780px] px-5 py-12 sm:px-6">
   <header className="mb-10">
   <h1 className="font-display text-[36px] font-medium leading-tight text-[var(--landing-text)]">
    CometJacking: One Click Can Turn Perplexity&apos;s AI Browser Against You
   </h1>
   <p className="mt-4 text-[15px] leading-7 text-[var(--landing-muted)]">
    LayerX security researchers discovered a vulnerability in Perplexity&apos;s Comet AI
    browser where a single malicious URL can hijack the AI assistant, steal emails,
    calendar data, and exfiltrate sensitive information without the user noticing.
   </p>
   <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-[var(--landing-faint)]">
    <span>October 4, 2025</span>
    <span aria-hidden="true">&middot;</span>
    <span>Source: LayerX Security Research</span>
    <span aria-hidden="true">&middot;</span>
    <span>By Aviad Gispan</span>
   </div>
   </header>

   <div className="relative mb-10 overflow-hidden rounded-[20px] border border-[var(--landing-chip)]">
   <Image
    src="/images/cometjacking-perplexity-ai-browser.jpg"
    alt="CometJacking AI browser vulnerability concept"
    width={1600}
    height={900}
    className="h-auto w-full object-cover"
    priority
   />
   </div>

   <div className="prose prose-sm max-w-none space-y-6 text-[var(--landing-body)] [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--landing-text)] [&_h2]:mt-10 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-justify [&_strong]:text-[var(--landing-text)]">
   <h2>The vulnerability</h2>
   <p>
    LayerX security researchers discovered a critical vulnerability in Perplexity&apos;s
    new AI-powered Comet browser, named CometJacking. A single weaponized URL, without
    any malicious page content, is enough to let an attacker steal any sensitive data that
    has been exposed in the Comet browser. If the user asked Comet to rewrite an email or
    schedule an appointment, that content can be exfiltrated to the attacker.
   </p>
   <p>
    The attack requires only that a user opens a crafted link sent via email, an extension,
    or a malicious site. From there, the AI browser is hijacked without the user noticing
    anything unusual. Unlike prior prompt injection attacks, this vector prioritizes user
    memory via URL parameters and evades exfiltration checks with trivial encoding.
   </p>

   <h2>How CometJacking works</h2>
   <p>
    When a user clicks a link or is silently redirected, Comet parses the URL&apos;s query
    string and interprets portions as agent instructions. The URL contains a prompt and
    parameters that trigger Perplexity to look for data in memory and connected services
    like Gmail and Calendar. The AI is then instructed to encode the results in base64 and
    POST them to an attacker-controlled endpoint.
   </p>
   <p>
    The attack executes in five steps. First, the attacker sends a malicious link. Second,
    hidden in the URL is a command telling the AI what to do. Third, the AI follows the
    attacker&apos;s instructions, accessing any personal information exposed to it. Fourth,
    the data is disguised using base64 encoding to bypass security checks. Fifth, the
    encoded payload is sent to the attacker&apos;s remote server. The user never enters a
    password and nothing appears wrong.
   </p>

   <h2>What can be stolen</h2>
   <p>
    Because Perplexity&apos;s AI browser can integrate with connectors such as Gmail and
    Calendar, any action performed through the assistant may expose sensitive personal
    data. LayerX demonstrated proof-of-concept attacks that could steal emails and harvest
    calendar invites, revealing sensitive information about meetings, contacts, and internal
    company structure. The compromised AI could also be instructed to send emails on the
    user&apos;s behalf or search for files in connected corporate drives.
   </p>
   <p>
    This marks a fundamental shift in browser security. Attackers no longer need the
    user&apos;s password they just need to hijack the agent that is already logged in. The
    risk moves from passive data theft to active command execution.
   </p>

   <h2>Disclosure and response</h2>
   <p>
    LayerX submitted its findings to Perplexity under responsible disclosure guidelines on
    August 27, 2025. Perplexity replied that it could not identify any security impact and
    marked the report as Not Applicable. The vulnerability remains unpatched, highlighting
    the need for organizations to take independent security measures when adopting AI-native
    browsers.
   </p>
   <p>
    For enterprises, a single click could allow an attacker to gain a foothold, move
    laterally across systems, and manipulate corporate communication channels, all under
    the guise of a legitimate user&apos;s activity. As AI browsers become more common,
    security teams must treat them as the next frontier for cyberattacks.
   </p>
   </div>

   <div className="mt-14 rounded-[20px] border border-[var(--landing-chip)] bg-[var(--landing-card)] p-8 text-center sm:p-10">
   <h2 className="font-display text-[22px] font-medium text-[var(--landing-text)]">
    Your AI browser should not be a spy.
   </h2>
   <p className="mx-auto mt-3 max-w-[520px] text-[14px] leading-7 text-[var(--landing-muted)]">
    {brandName} encrypts your conversations end-to-end. No URL parameter can hijack what
    is already protected before it reaches the browser.
   </p>
   <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
    <Link
    href="/signup"
    className="inline-flex items-center gap-2 rounded-lg bg-[var(--landing-button)] px-5 py-3 text-[13px] font-medium text-[var(--landing-button-text)] transition hover:opacity-90"
    >
    Try {brandName} free
    <ArrowRight size={14} />
    </Link>
    <Link
    href="/how-it-works"
    className="text-[13px] font-medium text-[var(--landing-muted)] transition hover:text-[var(--landing-text)]"
    >
    See how it works
    </Link>
   </div>
   </div>

   <p className="mt-10 border-t border-[var(--landing-chip)] pt-8 text-[13px] leading-6 text-[var(--landing-faint)]">
   This article is based on research by Aviad Gispan and LayerX Security, published on
   October 4, 2025. The original post appeared under the title &quot;Is Perplexity Comet
   Safe? LayerX Finds a Prompt Injection Attack Vector.&quot;
   </p>
  </article>
  </main>

  <footer className="border-t border-[var(--landing-chip)]">
  <div className="mx-auto flex max-w-[780px] flex-col items-center justify-between gap-4 px-5 py-8 text-[13px] text-[var(--landing-faint)] sm:flex-row">
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
