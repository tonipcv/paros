"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ChevronDown, Image, Paperclip, Search } from "lucide-react";

const tools = [
  { label: "Attach", icon: Paperclip },
  { label: "Search", icon: Search },
  { label: "Image", icon: Image },
];

export function LandingChatPrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  function goToLogin() {
    const trimmed = prompt.trim();
    if (trimmed) {
      sessionStorage.setItem("notopen_pending_prompt", trimmed);
    }
    router.push(`/login?intent=chat${trimmed ? `&prompt=${encodeURIComponent(trimmed)}` : ""}`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToLogin();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      goToLogin();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-10 w-full rounded-[28px] bg-[var(--landing-card)] p-3 shadow-[var(--landing-hero-shadow)]"
    >
      <div className="rounded-[22px] bg-[var(--landing-field)] p-4 shadow-[var(--landing-card-shadow)]">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goToLogin}
            className="flex items-center gap-2 rounded-full bg-[var(--landing-chip)] px-3 py-1.5 text-[12px] text-[var(--landing-body)] transition hover:bg-white/[0.1] hover:text-[var(--landing-text)]"
          >
            NotOpen
            <ChevronDown size={14} className="text-[var(--landing-faint)]" />
          </button>
          <span className="text-[12px] text-[var(--landing-faint)]">Private</span>
        </div>

        <label htmlFor="landing-prompt" className="sr-only">
          Message NotOpen
        </label>
        <textarea
          id="landing-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message NotOpen..."
          className="mt-5 min-h-[96px] w-full resize-none bg-transparent text-[18px] leading-7 text-[var(--landing-text)] outline-none placeholder:text-[#555]"
        />

        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.label}
                  type="button"
                  onClick={goToLogin}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--landing-chip)] px-3 py-1.5 text-[12px] text-[var(--landing-muted)] transition hover:bg-white/[0.1] hover:text-[var(--landing-text)]"
                >
                  <Icon size={13} />
                  {tool.label}
                </button>
              );
            })}
          </div>
          <button
            type="submit"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--landing-button)] text-[var(--landing-button-text)] transition hover:opacity-90"
            aria-label="Sign in to send prompt"
          >
            <ArrowUp size={17} />
          </button>
        </div>
      </div>
    </form>
  );
}
