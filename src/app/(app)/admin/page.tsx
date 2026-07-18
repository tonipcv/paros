"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Mail, Users, UserCheck, Ghost, Coins, ClipboardList } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useRouter } from "next/navigation";
import { Badge, Button, EmptyState, PageContainer, PageHeader, PageSkeleton, StatCard } from "@/components/ui";

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

  const actionLabel = (a: string) => {
    const m: Record<string, string> = { promote_user: "Promoted", set_credits: "Credits", change_plan: "Plan", health_check: "Health check", test_email: "Test email" };
    return m[a] || a;
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Admin"
        description={
          stats
            ? `${stats.users.total} users · ${stats.health.degraded === 0 ? "all systems healthy" : `${stats.health.degraded}/${stats.health.total} degraded`}`
            : "Workspace overview"
        }
        actions={
          <>
            <Button variant="secondary" onClick={runHealthCheck} disabled={hcRunning}>
              <RefreshCw size={14} className={hcRunning ? "animate-spin" : ""} />
              {hcRunning ? "Checking…" : "Health check"}
            </Button>
            <Button variant="secondary" onClick={sendTestEmail} disabled={emailRunning}>
              <Mail size={14} />
              {emailRunning ? "Sending…" : "Test email"}
            </Button>
          </>
        }
      />

      {!stats ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Users" value={stats.users.total} />
            <StatCard icon={UserCheck} label="Active today" value={stats.users.todayActive} />
            <StatCard icon={Ghost} label="Guests" value={stats.users.guests} />
            <StatCard icon={Coins} label="Total credits" value={stats.credits.total.toLocaleString("en-US")} />
          </div>

          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-h3 text-primary">Recent actions</h2>
              <button onClick={loadAudit} className="text-caption text-muted transition hover:text-primary">Refresh</button>
            </div>
            {audit.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No admin actions yet" description="Actions taken by admins will appear here." />
            ) : (
              <div>
                {audit.slice(0, 15).map((a) => (
                  <div key={a.id} className="flex items-center justify-between border-t border-borderDefault py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-medium text-primary">{actionLabel(a.action)}</p>
                        <Badge>{a.adminEmail}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {a.targetEmail ? `Target: ${a.targetEmail}` : "No target"}
                        {a.details ? ` · ${a.details}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-caption text-muted">{ago(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
