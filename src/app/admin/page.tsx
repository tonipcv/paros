"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Mail } from "lucide-react";

type Stats = {
  users: { total: number; free: number; guests: number; activeSessions: number; todayActive: number };
  credits: { total: number };
  health: { degraded: number; total: number };
  trends: { usersByDay: { day: string; count: number }[]; creditsByDay: { day: string; credits: number }[] };
};

type AuditEntry = {
  id: string;
  adminEmail: string;
  action: string;
  targetEmail: string | null;
  details: string | null;
  createdAt: string;
};

function ago(date: string) {
  const ms = Date.now() - new Date(date).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [hcRunning, setHcRunning] = useState(false);
  const [emailRunning, setEmailRunning] = useState(false);

  async function loadAudit() {
    const res = await fetch("/api/admin/audit").then((r) => r.json());
    setAudit(res.actions || []);
  }

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then(setStats).catch(() => {});
    loadAudit();
  }, []);

  async function runHealthCheck() {
    setHcRunning(true);
    const res = await fetch("/api/admin/health-check", { method: "POST" }).then((r) => r.json()).catch(() => null);
    setHcRunning(false);
    if (res?.checks) toast.success(`${res.checks} checks ran, ${res.changed} changed`);
    else toast.error("Health check failed");
    loadAudit();
    fetch("/api/admin/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }

  async function sendTestEmail() {
    setEmailRunning(true);
    const res = await fetch("/api/admin/test-email", { method: "POST" }).then((r) => r.json()).catch(() => null);
    setEmailRunning(false);
    if (res?.ok) toast.success(`Test email sent to ${res.sentTo}`);
    else toast.error(res?.error || "Failed");
    loadAudit();
  }

  if (!stats) return <p className="p-6 text-sm text-muted">Loading...</p>;

  const cards = [
    { label: "Total users", value: stats.users.total, href: "/admin/users" },
    { label: "Active today", value: stats.users.todayActive },
    { label: "Free plan users", value: stats.users.free },
    { label: "Guest accounts", value: stats.users.guests },
    { label: "Active sessions", value: stats.users.activeSessions },
    { label: "Total credits", value: stats.credits.total.toLocaleString("en-US") },
  ];

  const actionLabel = (a: string) => {
    const m: Record<string, string> = { promote_user: "Promoted", set_credits: "Credits", change_plan: "Plan", health_check: "Health check", test_email: "Test email" };
    return m[a] || a;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary">Admin Dashboard</h1>
        <div className="flex gap-2">
          <button onClick={runHealthCheck} disabled={hcRunning} className="btn-secondary text-[12px] px-3 py-1.5">
            <RefreshCw size={14} className={`inline mr-1.5 ${hcRunning ? "animate-spin" : ""}`} />
            {hcRunning ? "Running..." : "Health check"}
          </button>
          <button onClick={sendTestEmail} disabled={emailRunning} className="btn-secondary text-[12px] px-3 py-1.5">
            <Mail size={14} className="inline mr-1.5" />
            {emailRunning ? "Sending..." : "Test email"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-[12px] uppercase tracking-wide text-tertiary">{c.label}</p>
            <p className="mt-1.5 text-2xl font-semibold text-primary">
              {c.href ? <a href={c.href} className="hover:underline">{c.value}</a> : c.value}
            </p>
          </div>
        ))}
        <div className="card p-4">
          <p className="text-[12px] uppercase tracking-wide text-tertiary">Health</p>
          <p className={`mt-1.5 text-2xl font-semibold ${stats.health.degraded > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            <a href="/health" className="hover:underline">{stats.health.degraded === 0 ? "All healthy" : `${stats.health.degraded}/${stats.health.total} degraded`}</a>
          </p>
        </div>
      </div>

      {/* Trends */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-primary mb-3">Trends (last 30 days)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-4">
            <p className="text-[11px] uppercase tracking-wide text-tertiary mb-3">New users per day</p>
            <div className="flex items-end gap-0.5 h-24">
              {stats.trends.usersByDay.length === 0 && <p className="text-xs text-muted">No data yet</p>}
              {stats.trends.usersByDay.map((d) => {
                const max = Math.max(...stats.trends.usersByDay.map((x) => x.count), 1);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center" title={`${d.day}: ${d.count}`}>
                    <span className="text-[9px] text-muted mb-1">{d.count || ""}</span>
                    <div className="w-full bg-highlight rounded-t" style={{ height: `${(d.count / max) * 80}px` }} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card p-4">
            <p className="text-[11px] uppercase tracking-wide text-tertiary mb-3">Credits consumed per day</p>
            <div className="flex items-end gap-0.5 h-24">
              {stats.trends.creditsByDay.length === 0 && <p className="text-xs text-muted">No data yet</p>}
              {stats.trends.creditsByDay.map((d) => {
                const max = Math.max(...stats.trends.creditsByDay.map((x) => x.credits), 1);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center" title={`${d.day}: ${d.credits}`}>
                    <span className="text-[9px] text-muted mb-1">{d.credits || ""}</span>
                    <div className="w-full bg-amber-500/40 rounded-t" style={{ height: `${(d.credits / max) * 80}px` }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Audit log */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-primary">Recent admin actions</h2>
          <button onClick={loadAudit} className="text-[11px] text-tertiary hover:text-primary">Refresh</button>
        </div>
        {audit.length === 0 ? (
          <p className="text-xs text-muted">No admin actions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-borderDefault text-[11px] uppercase tracking-wide text-tertiary">
                  <th className="px-3 py-2 font-medium">Admin</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Details</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderDefault">
                {audit.slice(0, 20).map((a) => (
                  <tr key={a.id} className="hover:bg-bgHover">
                    <td className="px-3 py-2 text-[12px] text-muted truncate max-w-[120px]">{a.adminEmail}</td>
                    <td className="px-3 py-2 text-[12px] text-primary">{actionLabel(a.action)}</td>
                    <td className="px-3 py-2 text-[12px] text-muted truncate max-w-[120px]">{a.targetEmail || "—"}</td>
                    <td className="px-3 py-2 text-[11px] text-muted hidden sm:table-cell truncate max-w-[200px]">{a.details || "—"}</td>
                    <td className="px-3 py-2 text-[11px] text-muted hidden sm:table-cell">{ago(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
