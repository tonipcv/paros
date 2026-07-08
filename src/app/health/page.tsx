"use client";

import { useEffect, useState } from "react";
import type { CheckResult } from "@/lib/monitor";

type Summary = {
  checks: (CheckResult & { lastCheck: string })[];
  degraded: number;
  total: number;
};

const labels: Record<string, string> = {
  db: "Database",
  "attestation:tee": "Attestation (TEE)",
  "attestation:e2ee": "Attestation (E2EE)",
  "email:provider": "Email provider",
  "stripe:webhook": "Stripe webhook",
};

function statusBadge(status: string) {
  if (status === "healthy") return { color: "bg-emerald-500", label: "Healthy" };
  if (status === "degraded") return { color: "bg-amber-500", label: "Degraded" };
  return { color: "bg-rose-500", label: "Down" };
}

function ago(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

export default function HealthPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setSummary)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="min-h-screen px-5 py-8" style={{ background: "#eceef1" }}>
      <div className="mx-auto max-w-[720px]">
        <h1 className="text-2xl font-semibold text-[#0b0f19]">System health</h1>
        <p className="mt-1 text-sm text-gray-500">Last probe results (checks run daily).</p>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

        {summary && (
          <>
            <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4 text-sm">
              {summary.degraded === 0 ? (
                <span className="text-emerald-700 font-medium">All {summary.total} systems operational.</span>
              ) : (
                <span className="text-amber-700 font-medium">
                  {summary.degraded} of {summary.total} systems reporting issues.
                </span>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {summary.checks.map((c) => {
                const badge = statusBadge(c.status);
                return (
                  <div
                    key={c.name}
                    className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${badge.color}`} />
                      <div>
                        <p className="text-sm font-semibold text-[#0b0f19]">
                          {labels[c.name] || c.name}
                        </p>
                        {c.message && (
                          <p className="mt-0.5 text-xs text-gray-500">{c.message}</p>
                        )}
                        <p className="mt-1 text-[11px] text-gray-400">
                          {c.lastCheck !== "never" ? ago(c.lastCheck) : "never"} · {c.durationMs ?? "?"}ms
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        c.status === "healthy"
                          ? "bg-emerald-50 text-emerald-700"
                          : c.status === "degraded"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
