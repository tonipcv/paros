"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Image as ImageIcon, Code2, ArrowRight } from "lucide-react";

const appName = "NotOpen";

const goals = [
  { id: "chat", label: "Chat with AI models", icon: MessageSquare },
  { id: "images", label: "Generate images", icon: ImageIcon },
  { id: "api", label: "Build with the API", icon: Code2 },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [goal, setGoal] = useState("chat");
  const [loading, setLoading] = useState(false);

  async function finish() {
    setLoading(true);
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceName, goal }),
    });
    router.replace("/chat");
  }

  return (
    <div className="landing-theme min-h-screen px-5 py-8">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={appName} className="h-8 w-8 rounded-lg" />
          <span className="text-[15px] font-semibold tracking-[0.08em] text-[var(--landing-text)]">{appName}</span>
        </div>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-96px)] max-w-[1180px] items-center gap-12 py-12 lg:grid-cols-[0.95fr_0.85fr]">
        <div className="hidden max-w-xl lg:block">
          <p className="text-[13px] text-[var(--landing-faint)]">Workspace setup</p>
          <h1 className="font-display mt-4 text-[42px] font-medium leading-[1.02] text-[var(--landing-text)]">
            Set up NotOpen.
          </h1>
        </div>

        <div className="w-full rounded-[28px] bg-[var(--landing-card)] p-5 shadow-[var(--landing-card-shadow)] sm:p-7">
        <h1 className="font-display text-[32px] font-medium leading-tight text-[var(--landing-text)]">Welcome aboard</h1>
        <p className="mb-7 mt-2 text-sm text-[var(--landing-faint)]">Let&apos;s set up your workspace.</p>

        <label className="mb-1.5 block text-xs font-medium text-[var(--landing-faint)]">Workspace name</label>
        <input
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          placeholder="My Workspace"
          className="mb-5 h-11 w-full rounded-lg bg-[var(--landing-field)] px-3 text-sm text-[var(--landing-text)] outline-none placeholder:text-[var(--landing-faint)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:ring-1 focus:ring-[var(--landing-faint)]"
        />

        <label className="mb-1.5 block text-xs font-medium text-[var(--landing-faint)]">What do you want to do first?</label>
        <div className="mb-6 grid gap-2">
          {goals.map((g) => {
            const Icon = g.icon;
            return (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition ${
                  goal === g.id
                    ? "bg-[var(--landing-button)] text-[var(--landing-button-text)]"
                    : "bg-[var(--landing-chip)] text-[var(--landing-body)] hover:bg-[var(--landing-chip)] hover:text-[var(--landing-text)]"
                }`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${goal === g.id ? "bg-[var(--landing-chip)] text-[var(--landing-button-text)]" : "bg-[var(--landing-field)] text-[var(--landing-text)]"}`}>
                  <Icon size={16} />
                </span>
                {g.label}
              </button>
            );
          })}
        </div>

        <button onClick={finish} disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--landing-button)] text-sm font-medium text-[var(--landing-button-text)] transition hover:opacity-90 disabled:opacity-50">
          {loading ? "Setting up..." : "Enter workspace"}
          <ArrowRight size={16} />
        </button>
        </div>
      </div>
    </div>
  );
}
