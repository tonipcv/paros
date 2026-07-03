"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace("language-", "") || "";
  return (
    <div className="group/code relative my-3 overflow-hidden rounded-lg border border-borderDefault bg-bg">
      <div className="flex items-center justify-between border-b border-borderDefault px-3 py-1.5">
        <span className="text-[11px] text-tertiary">{lang || "code"}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 text-[11px] text-tertiary transition hover:text-primary"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-auto p-3 text-[12.5px] leading-relaxed text-silver">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="text-[15px] leading-7 text-primary [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-3 whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
          li: ({ children }) => <li className="leading-7">{children}</li>,
          h1: ({ children }) => <h1 className="mb-3 mt-5 text-xl font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-5 text-lg font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold">{children}</h3>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2 hover:text-primary">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-highlight">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-borderHover pl-4 text-secondary">{children}</blockquote>
          ),
          hr: () => <hr className="my-4 border-borderDefault" />,
          table: ({ children }) => (
            <div className="my-3 overflow-auto">
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-borderDefault bg-surface px-3 py-1.5 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-borderDefault px-3 py-1.5">{children}</td>,
          code: ({ className, children }) => {
            const text = String(children).replace(/\n$/, "");
            const isBlock = className?.includes("language-") || text.includes("\n");
            if (isBlock) return <CodeBlock className={className}>{text}</CodeBlock>;
            return <code className="rounded bg-bgActive px-1.5 py-0.5 text-[13px] text-accent">{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
