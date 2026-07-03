"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Image as ImageIcon, Code2, ArrowRight } from "lucide-react";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Nebula AI";

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
    <div className="flex min-h-screen items-center justify-center bg-bg p-5 text-silver">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 sm:p-8">
        <div className="mb-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={appName} className="h-8 w-8 rounded-btn" />
          <span className="text-[15px] font-semibold text-grad-light">{appName}</span>
        </div>
        <h1 className="mt-4 text-[24px] font-semibold text-primary">Welcome aboard</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Let&apos;s set up your workspace.</p>

        <label className="label">Workspace name</label>
        <input
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          placeholder="My Workspace"
          className="input mb-5"
        />

        <label className="label">What do you want to do first?</label>
        <div className="mb-6 grid gap-2">
          {goals.map((g) => {
            const Icon = g.icon;
            return (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition ${
                  goal === g.id
                    ? "border-highlight bg-surface text-primary"
                    : "border-borderDefault text-secondary hover:border-borderHover"
                }`}
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-borderDefault bg-bg text-silver">
                  <Icon size={16} />
                </span>
                {g.label}
              </button>
            );
          })}
        </div>

        <button onClick={finish} disabled={loading} className="btn-primary h-11 w-full">
          {loading ? "Setting up…" : "Enter workspace"}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
