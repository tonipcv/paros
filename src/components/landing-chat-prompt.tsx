"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUp, Image, Paperclip, Search } from "lucide-react";

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
    <motion.form
      onSubmit={submit}
      whileHover={{ scale: 1.005 }}
      transition={{ duration: 0.25 }}
      className="mx-auto mt-12 w-full max-w-[680px] rounded-[26px] bg-[var(--landing-card)] p-2.5 shadow-[var(--landing-hero-shadow)]"
    >
      <div className="rounded-[20px] bg-[var(--landing-field)] px-4 pb-3 pt-4 shadow-[var(--landing-card-shadow)]">
        <label htmlFor="landing-prompt" className="sr-only">
          Message NotOpen
        </label>
        <textarea
          id="landing-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message NotOpen..."
          className="min-h-[72px] w-full resize-none bg-transparent text-[16px] leading-7 text-[var(--landing-text)] outline-none placeholder:text-[#555]"
        />

        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="flex gap-1.5">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.label}
                  type="button"
                  onClick={goToLogin}
                  aria-label={tool.label}
                  className="grid h-8 w-8 place-items-center rounded-full text-[var(--landing-faint)] transition hover:bg-white/[0.08] hover:text-[var(--landing-text)]"
                >
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
          <button
            type="submit"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--landing-button)] text-[var(--landing-button-text)] transition hover:opacity-90"
            aria-label="Sign in to send prompt"
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </motion.form>
  );
}
