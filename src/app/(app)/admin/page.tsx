"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Mail } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useRouter } from "next/navigation";

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
  const { user, loaded } = useAppStore();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [hcRunning, setHcRunning] = useState(false);
  const [emailRunning, setEmailRunning] = useState(false);

  useEffect(() => {
    if (loaded && user && user.role === "USER") { router.replace("/chat"); return; }
  }, [loaded, user, router]);

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
    if (res?.checks) { toast.success(`${res.checks} checks complete`); loadAudit(); fetch("/api/admin/stats").then((r) => r.json()).then(setStats).catch(() => {}); }
    else toast.error("Health check failed");
  }

  async function sendTestEmail() {
    setEmailRunning(true);
    const res = await fetch("/api/admin/test-email", { method: "POST" }).then((r) => r.json()).catch(() => null);
    setEmailRunning(false);
    if (res?.ok) toast.success(`Test email sent`);
    else toast.error(res?.error || "Failed");
    loadAudit();
  }

  if (!stats) return <p className="p-6 text-sm text-muted">Loading...</p>;

  const metrics = [
    { label: "Users", value: stats.users.total },
    { label: "Active today", value: stats.users.todayActive },
    { label: "Guests", value: stats.users.guests },
    { label: "Total credits", value: stats.credits.total.toLocaleString("en-US") },
  ];

  const actionLabel = (a: string) => {
    const m: Record<string, string> = { promote_user: "Promoted", set_credits: "Credits", change_plan: "Plan", health_check: "Health check", test_email: "Test email" };
    return m[a] || a;
  };

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-h1 text-grad-light">Admin</h1>
        <p className="mt-1 text-sm text-muted">
          {stats.users.total} users · {stats.health.degraded === 0 ? "all systems healthy" : `${stats.health.degraded}/${stats.health.total} degraded`}
        </p>
        <div className="mt-3 flex gap-2">
          <button onClick={runHealthCheck} disabled={hcRunning} className="btn-secondary flex items-center gap-1.5 text-[12px]">
            <RefreshCw size={14} className={hcRunning ? "animate-spin" : ""} />
            {hcRunning ? "Checking..." : "Health check"}
          </button>
          <button onClick={sendTestEmail} disabled={emailRunning} className="btn-secondary flex items-center gap-1.5 text-[12px]">
            <Mail size={14} />
            {emailRunning ? "Sending..." : "Test email"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {metrics.map((m) => (
          <div key={m.label} className="card p-5">
            <p className="label">{m.label}</p>
            <p className="mt-1 text-2xl font-semibold text-grad-stat">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-primary">Recent actions</h2>
          <button onClick={loadAudit} className="text-[12px] text-muted hover:text-primary">Refresh</button>
        </div>
        {audit.length === 0 ? (
          <p className="text-xs text-muted">No admin actions recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {audit.slice(0, 15).map((a) => (
              <div key={a.id} className="card flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-primary truncate">{actionLabel(a.action)}</p>
                  <p className="text-[11px] text-muted">
                    {a.adminEmail} {a.targetEmail ? `→ ${a.targetEmail}` : ""}
                  </p>
                  {a.details && <p className="text-[10px] text-tertiary truncate">{a.details}</p>}
                </div>
                <span className="shrink-0 text-[11px] text-muted">{ago(a.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
