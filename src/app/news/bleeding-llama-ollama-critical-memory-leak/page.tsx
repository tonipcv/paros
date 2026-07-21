import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const brandName = "NotOpen";

export const metadata: Metadata = {
 title: "Bleeding Llama: Critical Unauthenticated Memory Leak in Ollama",
 description:
 "A critical vulnerability (CVE-2026-7482, CVSS 9.1) in Ollama enables unauthenticated attackers to leak entire process memory, impacting 300,000 exposed servers globally.",
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
    Bleeding Llama: Critical Unauthenticated Memory Leak in Ollama
   </h1>
   <p className="mt-4 text-[15px] leading-7 text-[var(--landing-muted)]">
    Cyera Research discovered a critical vulnerability in Ollama (CVE-2026-7482, CVSS 9.1)
    that allows unauthenticated attackers to leak the entire process memory, exposing user
    prompts, system prompts, and environment variables from over 300,000 exposed servers.
   </p>
   <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-[var(--landing-faint)]">
    <span>May 5, 2026</span>
    <span aria-hidden="true">&middot;</span>
    <span>Source: Cyera Research</span>
    <span aria-hidden="true">&middot;</span>
    <span>By Dor Attias</span>
   </div>
   </header>

   <div className="relative mb-10 overflow-hidden rounded-[20px] border border-[var(--landing-chip)]">
   <Image
    src="/images/bleeding-llama-ollama-critical-memory-leak.jpg"
    alt="Cybersecurity concept representing the Ollama critical memory leak vulnerability"
    width={1600}
    height={900}
    className="h-auto w-full object-cover"
    priority
   />
   </div>

   <div className="prose prose-sm max-w-none space-y-6 text-[var(--landing-body)] [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--landing-text)] [&_h2]:mt-10 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-justify [&_strong]:text-[var(--landing-text)]">
   <h2>The vulnerability</h2>
   <p>
    Cyera Research discovered a critical vulnerability in Ollama, the popular open-source
    platform for running large language models locally. Tracked as CVE-2026-7482 with a
    CVSS score of 9.1, the flaw allows unauthenticated attackers to leak the entire Ollama
    process memory, potentially impacting over 300,000 servers exposed on the internet.
   </p>
   <p>
    The leaked memory contains highly sensitive information: user messages and prompts sent
    to AI models, system prompts configured by administrators, and environment variables
    from the host machine that may include API keys, access credentials, and proprietary
    data. The attack requires no authentication and can be executed with just three API
    calls.
   </p>

   <h2>How it works</h2>
   <p>
    Ollama listens on all network interfaces (0.0.0.0) by default with no authentication.
    The vulnerability resides in the GGUF file processing pipeline, specifically in the
    <code> WriteTo</code> function that handles tensor quantization. By crafting a malicious
    GGUF file with an oversized tensor shape, attackers can trigger an out-of-bounds heap
    read that spills adjacent memory contents into the output model file.
   </p>
   <p>
    The attack exploits the <code>unsafe</code> package in Go, which Ollama uses for
    low-level memory operations. A specially crafted GGUF file sets a tensor shape to a
    very large number of elements, causing the conversion loop to read past the end of the
    actual data buffer. The out-of-bounds read captures whatever resides in heap memory
    adjacent to the buffer, including prompts from other users and system environment
    variables.
   </p>

   <h2>Exfiltration</h2>
   <p>
    After the malicious model is created with leaked heap data, attackers use Ollama&apos;s
    <code>/api/push</code> endpoint to upload the compromised model to an attacker-controlled
    server. The model name can be set to an HTTP URI pointing to the attacker&apos;s
    infrastructure, and Ollama will push the entire file without any validation. This means
    the leaked data arrives on the attacker&apos;s server in a readable format.
   </p>
   <p>
    The researchers demonstrated that F16 to F32 quantization is lossless, allowing the
    leaked heap data to survive the conversion process intact. Once exfiltrated, the
    attacker can reverse the process and read raw heap contents, including user prompts
    and environment variables.
   </p>

   <h2>Impact and disclosure</h2>
   <p>
    With over 300,000 Ollama servers exposed to the internet without authentication, the
    potential for大规模 data extraction is significant. Enterprises using Ollama for
    internal AI deployments could have sensitive proprietary code, customer contracts,
    API keys, and internal communications extracted by remote attackers. The risk is
    amplified when Ollama is connected to tools like Claude Code, where tool outputs
    flow through the server.
   </p>
   <p>
    The vulnerability was responsibly disclosed to Ollama on February 2, 2026. A fix was
    proposed on February 25, 2026, and the CVE was published on May 1, 2026, with Cyera
    publishing their research on May 2, 2026. Organizations running Ollama should update
    immediately and ensure their instances are not exposed to the internet without
    authentication.
   </p>
   </div>

   <div className="mt-14 rounded-[20px] border border-[var(--landing-chip)] bg-[var(--landing-card)] p-8 text-center sm:p-10">
   <h2 className="font-display text-[22px] font-medium text-[var(--landing-text)]">
    Your AI conversations should stay private.
   </h2>
   <p className="mx-auto mt-3 max-w-[520px] text-[14px] leading-7 text-[var(--landing-muted)]">
    {brandName} encrypts your conversations end-to-end by default. No server-side memory,
    no data leaks, no exposure. Private by design.
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
   This article is based on research by Dor Attias and Cyera Research, published on May 5,
   2026. The original post appeared under the title &quot;Bleeding Llama: Critical
   Unauthenticated Memory Leak in Ollama.&quot;
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
