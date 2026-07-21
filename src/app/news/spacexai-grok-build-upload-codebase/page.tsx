import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const brandName = "NotOpen";

export const metadata: Metadata = {
 title: "SpaceXAI's Grok Build Was Uploading Users' Entire Codebase to Cloud Storage",
 description:
 "Security researchers found SpaceXAI's Grok Build AI coding tool was uploading entire repositories, including excluded files and deleted secrets, to Google Cloud without clear disclosure.",
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
    SpaceXAI&apos;s Grok Build Was Uploading Users&apos; Entire Codebase to Cloud Storage
   </h1>
   <p className="mt-4 text-[15px] leading-7 text-[var(--landing-muted)]">
    Security researchers discovered that SpaceXAI&apos;s Grok Build AI coding tool was
    uploading entire code repositories to Google Cloud, including files explicitly excluded
    and secrets deleted from history, before the company disabled the feature.
   </p>
   <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-[var(--landing-faint)]">
    <span>July 14, 2026</span>
    <span aria-hidden="true">&middot;</span>
    <span>Source: The Verge</span>
    <span aria-hidden="true">&middot;</span>
    <span>By Stevie Bonifield</span>
   </div>
   </header>

   <div className="relative mb-10 overflow-hidden rounded-[20px] border border-[var(--landing-chip)]">
   <Image
    src="/images/spacexai-grok-build-codebase.jpg"
    alt="SpaceXAI Grok Build AI coding tool interface concept"
    width={1600}
    height={900}
    className="h-auto w-full object-cover"
    priority
   />
   </div>

   <div className="prose prose-sm max-w-none space-y-6 text-[var(--landing-body)] [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--landing-text)] [&_h2]:mt-10 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-justify [&_strong]:text-[var(--landing-text)]">
   <h2>What happened</h2>
   <p>
    SpaceXAI&apos;s Grok Build AI coding tool was spotted uploading users&apos; entire
    codebases to Google Cloud before it was reported, and the company turned it off.
    Security research firm Cereblab published findings showing how the Grok Build CLI was
    packaging and uploading entire code repositories, including files it was told not to
    open and secrets deleted from history, significantly more data retention than similar
    tools like Claude Code.
   </p>
   <p>
    The researchers say that as of Monday, their tests show SpaceXAI&apos;s servers
    returning a &ldquo;disable_codebase_upload: true&rdquo; flag, and the codebase upload
    no longer fires. The discovery raises serious concerns about data privacy and the
    extent to which AI coding tools may be collecting sensitive information without users&apos;
    full awareness.
   </p>

   <h2>Elon Musk&apos;s response</h2>
   <p>
    Elon Musk responded to the incident in a post on X claiming that all data Grok Build
    previously uploaded will be &ldquo;completely and utterly deleted.&rdquo; Musk also said
    in a separate post that &ldquo;privacy settings are always respected,&rdquo; but asked
    users to allow SpaceXAI to retain their data, saying it&apos;s &ldquo;helpful for
    debugging issues.&rdquo;
   </p>
   <p>
    SpaceXAI initially responded to the issue with a post saying that if zero data retention
    is disabled, the /privacy command is available in the CLI to disable data retention,
    which also deletes previously synced data. However, Cereblab points out that /privacy
    is a per-session retention toggle, not the switch that fixed this, so it shouldn&apos;t
    be pointed to as the control.
   </p>

   <h2>Security experts weigh in</h2>
   <p>
    Dr. Lukasz Olejnik, an independent security researcher at King&apos;s College London,
    confirmed to The Verge that this amount of data retention is &ldquo;excessive,&rdquo;
    adding that the data potentially at risk could include proprietary source code,
    information about security vulnerabilities, personal data, infrastructure details,
    and credentials. The implications extend beyond individual developers enterprises
    using Grok Build for internal projects could have had their most sensitive code
    exposed without their knowledge.
   </p>
   <p>
    Open source and security communities have expressed alarm at the findings. Many draw
    parallels to previous incidents where AI tools were found to be collecting more data
    than disclosed. The incident also highlights a growing tension between the convenience
    of cloud-connected AI development tools and the privacy expectations of the developers
    who use them.
   </p>

   <h2>What it means for developers</h2>
   <p>
    This incident serves as a stark reminder that AI coding tools integrated with cloud
    storage can become vectors for data exfiltration, whether intentional or not.
    Developers and organizations that rely on AI-powered development tools should carefully
    audit what data these tools send to remote servers and ensure that privacy controls are
    both transparent and verifiable.
   </p>
   <p>
    The ability to trust that your development environment is not silently uploading your
    source code is fundamental. Any tool that requires cloud connectivity should provide
    clear, auditable guarantees about what data leaves your machine and under what
    circumstances.
   </p>
   </div>

   <div className="mt-14 rounded-[20px] border border-[var(--landing-chip)] bg-[var(--landing-card)] p-8 text-center sm:p-10">
   <h2 className="font-display text-[22px] font-medium text-[var(--landing-text)]">
    Your code should stay yours.
   </h2>
   <p className="mx-auto mt-3 max-w-[520px] text-[14px] leading-7 text-[var(--landing-muted)]">
    {brandName} encrypts your data before it leaves your device. No cloud upload, no
    server-side storage, no silent exfiltration. What you write stays with you.
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
   This article is based on reporting by Stevie Bonifield for The Verge, published on July
   14, 2026. The original story appeared under the title &quot;SpaceXAI&rsquo;s Grok
   programming tool was uploading its users&rsquo; entire codebase to cloud storage.&quot;
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
