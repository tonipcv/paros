import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const brandName = "NotOpen";

export const metadata: Metadata = {
 title: "US Court Rules Against S. Korean Gaming Company and Its AI-Hatched Takeover Plan",
 description:
 "A U.S. court ruled against Krafton, the South Korean gaming giant behind PUBG and Subnautica 2, after its CEO used ChatGPT to devise a plan to avoid paying a $250 million bonus.",
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
    US Court Rules Against S. Korean Gaming Company and Its AI-Hatched Takeover Plan
   </h1>
   <p className="mt-4 text-[15px] leading-7 text-[var(--landing-muted)]">
    A federal court ruled against Krafton, the South Korean gaming giant behind PUBG and
    Subnautica 2, after its CEO consulted ChatGPT for legal advice on how to avoid paying
    a $250 million bonus to the head of its own studio.
   </p>
   <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-[var(--landing-faint)]">
    <span>March 16, 2026</span>
    <span aria-hidden="true">&middot;</span>
    <span>Source: Reuters</span>
    <span aria-hidden="true">&middot;</span>
    <span>By Tom Hals</span>
   </div>
   </header>

   <div className="relative mb-10 overflow-hidden rounded-[20px] border border-[var(--landing-chip)]">
   <Image
    src="/images/us-court-rules-against-krafton-ai-hatched-takeover.jpg"
    alt="Courtroom and gavel symbolizing legal ruling"
    width={1600}
    height={900}
    className="h-auto w-full object-cover"
    priority
   />
   </div>

   <div className="prose prose-sm max-w-none space-y-6 text-[var(--landing-body)] [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--landing-text)] [&_h2]:mt-10 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-justify [&_strong]:text-[var(--landing-text)]">
   <h2>The case</h2>
   <p>
    A U.S. federal court ruled against Krafton, the South Korean gaming company behind PUBG
    and Subnautica 2, in a case that revealed the company&apos;s CEO had turned to ChatGPT
    for help engineering a takeover plan to avoid paying a massive bonus. The case centers
    on a $250 million bonus owed to the head of Unknown Worlds Entertainment, the studio
    behind Subnautica 2, which Krafton acquired.
   </p>
   <p>
    Court documents show that Krafton&apos;s CEO consulted ChatGPT for legal and strategic
    advice on how to structure a deal that would allow the company to sidestep the bonus
    payment. The AI chatbot was asked to help devise a takeover plan that would effectively
    eliminate the contractual obligation. The plan was subsequently put into motion, leading
    to the legal battle.
   </p>

   <h2>The AI-hatched plan</h2>
   <p>
    According to testimony, the CEO used ChatGPT to draft strategies and legal arguments
    aimed at circumventing the bonus clause in the studio head&apos;s contract. The AI tool
    suggested corporate restructuring approaches that would allow Krafton to claim the bonus
    was no longer applicable. The court found that these actions constituted bad faith and
    violated the terms of the original acquisition agreement.
   </p>
   <p>
    The case marks one of the first instances where the use of an AI chatbot for legal
    strategy has been formally examined in a U.S. court. Legal experts noted that while
    using AI for research is common, relying on it to devise a plan to breach a contract
    raises significant legal and ethical questions.
   </p>

   <h2>Court ruling</h2>
   <p>
    The judge ruled against Krafton, ordering the company to honor the bonus agreement and
    pay the $250 million owed to the studio head. The decision sends a clear message that
    using AI to circumvent contractual obligations will not shield companies from liability.
    The court emphasized that the use of AI does not change the fundamental legal principles
    governing contracts and good faith dealing.
   </p>
   <p>
    Krafton has indicated it may appeal the decision, but legal analysts expect the ruling
    to stand. The case has drawn widespread attention in the gaming industry and beyond, as
    companies increasingly turn to AI tools for business and legal decision-making.
   </p>

   <h2>Implications</h2>
   <p>
    This case highlights the growing risk of relying on AI for legal and strategic decisions
    without human oversight. While AI tools like ChatGPT can provide useful information,
    they lack the contextual understanding and ethical reasoning required for high-stakes
    business decisions. The ruling serves as a cautionary tale for executives who might be
    tempted to use AI as a replacement for proper legal counsel.
   </p>
   <p>
    For the gaming industry, the case also underscores the importance of transparent
    acquisition agreements and the risks of attempting to use technology to undermine
    contractual commitments made to creative talent.
   </p>
   </div>

   <div className="mt-14 rounded-[20px] border border-[var(--landing-chip)] bg-[var(--landing-card)] p-8 text-center sm:p-10">
   <h2 className="font-display text-[22px] font-medium text-[var(--landing-text)]">
    AI should assist, not replace good judgment.
   </h2>
   <p className="mx-auto mt-3 max-w-[520px] text-[14px] leading-7 text-[var(--landing-muted)]">
    {brandName} gives you private access to the best AI models without logging your
    conversations. Use AI wisely, knowing your data stays yours.
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
   This article is based on reporting by Tom Hals for Reuters, published on March 16, 2026.
   The original story appeared under the title &quot;US court rules against S Korean gaming
   company and its AI-hatched takeover plan.&quot;
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
