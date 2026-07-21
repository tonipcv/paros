import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const brandName = "NotOpen";

export const metadata: Metadata = {
 title: "News",
 description: `Latest technology and privacy news from ${brandName}.`,
 robots: { index: true, follow: true },
};

const articles = [
 {
 slug: "judge-allows-us-search-warrant-ai-chatbot-records",
 title: "Judge Allows US Search Warrant Targeting Executive's AI Chatbot Records",
 excerpt:
  "A Manhattan federal judge ruled that OpenAI must hand over a crypto executive's ChatGPT logs, rejecting claims of attorney-client privilege as premature.",
 date: "June 23, 2026",
 source: "Reuters",
 },
 {
 slug: "spacexai-grok-build-upload-codebase",
 title: "SpaceXAI's Grok Build Was Uploading Users' Entire Codebase to Cloud Storage",
 excerpt:
  "Security researchers found SpaceXAI's Grok Build AI coding tool was uploading entire repositories, including excluded files and deleted secrets, to Google Cloud.",
 date: "July 14, 2026",
 source: "The Verge",
 },
 {
 slug: "us-court-rules-against-krafton-ai-hatched-takeover",
 title: "US Court Rules Against S. Korean Gaming Company and Its AI-Hatched Takeover Plan",
 excerpt:
  "A federal court ruled against Krafton after its CEO used ChatGPT to devise a plan to avoid paying a $250 million bonus to the head of its own studio.",
 date: "March 16, 2026",
 source: "Reuters",
 },
 {
 slug: "google-dialogflow-chatbot-flaw-monitor-conversations",
 title: "Google Patched AI Chatbot Flaw That Could Have Exposed Customer Conversations",
 excerpt:
  "A critical vulnerability in Google's Dialogflow CX platform could have allowed attackers to hijack customer conversations and steal sensitive data.",
 date: "July 7, 2026",
 source: "Axios",
 },
];

export default function NewsPage() {
 return (
 <div
  className="landing-theme news min-h-screen"
 >
  <SiteHeader />

  <main>
  <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-8">
   <header className="mb-12">
   <h1 className="font-display text-[36px] font-medium leading-tight text-[var(--landing-text)]">
    News
   </h1>
   <p className="mt-2 text-[15px] leading-7 text-[var(--landing-muted)]">
    Technology, privacy, and AI news curated by {brandName}.
   </p>
   </header>

   <div className="space-y-6">
   {articles.map((article) => (
    <Link
    key={article.slug}
    href={`/news/${article.slug}`}
    className="block rounded-[20px] border border-[var(--landing-chip)] bg-[var(--landing-card)] p-6 transition hover:border-[var(--landing-muted)] sm:p-8"
    >
    <div className="flex flex-col gap-3">
     <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--landing-faint)]">
     {article.source} &middot; {article.date}
     </span>
     <h2 className="font-display text-[18px] font-medium leading-snug text-[var(--landing-text)] sm:text-[20px]">
     {article.title}
     </h2>
     <p className="text-[14px] leading-6 text-[var(--landing-muted)]">
     {article.excerpt}
     </p>
     <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--landing-faint)] transition group-hover:text-[var(--landing-text)]">
     Read more <ArrowRight size={13} />
     </span>
    </div>
    </Link>
   ))}
   </div>
  </div>
  </main>

  <footer className="border-t border-[var(--landing-chip)]">
  <div className="mx-auto flex max-w-[900px] flex-col items-center justify-between gap-4 px-5 py-8 text-[13px] text-[var(--landing-faint)] sm:flex-row">
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
