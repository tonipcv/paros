"use client";

import { useEffect, useState } from "react";

type Stats = {
  users: { total: number; free: number; guests: number; activeSessions: number };
  credits: { total: number };
  health: { degraded: number; total: number };
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  if (!stats) return <p className="p-8 text-sm text-muted">Loading...</p>;

  const cards = [
    { label: "Total users", value: stats.users.total, href: "/admin/users" },
    { label: "Free plan users", value: stats.users.free },
    { label: "Guest accounts", value: stats.users.guests },
    { label: "Active sessions", value: stats.users.activeSessions },
    { label: "Total credits", value: stats.credits.total.toLocaleString("en-US") },
    {
      label: "Health checks",
      value: `${stats.health.degraded === 0 ? "All healthy" : `${stats.health.degraded}/${stats.health.total} degraded`}`,
      href: "/health",
      status: stats.health.degraded === 0 ? "healthy" : ("degraded" as const),
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-primary">Admin Dashboard</h1>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-[12px] uppercase tracking-wide text-tertiary">{c.label}</p>
            <p className={`mt-1.5 text-2xl font-semibold ${c.status === "degraded" ? "text-amber-400" : "text-primary"}`}>
              {c.href ? (
                <a href={c.href} className="hover:underline">{c.value}</a>
              ) : (
                c.value
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
