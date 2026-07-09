"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { useRouter } from "next/navigation";

type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  workspace: { plan: string; credits: number } | null;
};

export default function AdminUsers() {
  const { user, loaded } = useAppStore();
  const router = useRouter();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [creditModal, setCreditModal] = useState<{ userId: string; email: string } | null>(null);
  const [creditDelta, setCreditDelta] = useState("0");

  useEffect(() => {
    if (loaded && user && user.role === "USER") { router.replace("/chat"); return; }
  }, [loaded, user, router]);

  useEffect(() => {
    fetch("/api/admin/users").then((r) => r.json()).then((d) => setUsers(d.users)).catch(() => {});
  }, []);

  async function updateRole(userId: string, role: string) {
    const res = await fetch(`/api/admin/users/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role }) });
    if (res.ok) { setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u))); toast.success(`Updated to ${role}`); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); }
  }

  async function adjustCredits() {
    if (!creditModal) return;
    const delta = parseInt(creditDelta, 10);
    if (!Number.isInteger(delta)) return toast.error("Enter a whole number");
    const res = await fetch(`/api/admin/users/${creditModal.userId}/credits`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta }) });
    if (res.ok) { const d = await res.json(); setUsers((prev) => prev.map((u) => (u.id === creditModal.userId ? { ...u, workspace: { ...u.workspace!, credits: d.credits } } : u))); toast.success(`${d.email}: ${d.previous} → ${d.credits}`); setCreditModal(null); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); }
  }

  async function changePlan(userId: string, plan: string) {
    const res = await fetch(`/api/admin/users/${userId}/plan`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, grantCredits: true }) });
    if (res.ok) { const d = await res.json(); setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, workspace: { ...u.workspace!, plan: d.plan } } : u))); toast.success(`${d.email}: ${d.previous} → ${d.plan}`); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); }
  }

  const filtered = users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()) || (u.name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-h1 text-grad-light">Users</h1>
        <p className="mt-1 text-sm text-muted">{users.length} accounts</p>
      </div>

      <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
        className="input mb-4 w-full" />

      <div className="space-y-2">
        {filtered.map((u) => (
          <div key={u.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-primary truncate">{u.email}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                <span>{u.workspace?.plan || "FREE"}</span>
                <span>·</span>
                <span>{(u.workspace?.credits ?? 0).toLocaleString()} credits</span>
                {!u.emailVerified && <><span>·</span><span className="text-amber-400">Unverified</span></>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <select value={u.workspace?.plan || "FREE"} onChange={(e) => changePlan(u.id, e.target.value)}
                className="rounded-lg bg-surface border border-borderDefault px-2 py-1.5 text-[11px] font-medium text-muted">
                {["FREE", "STARTER", "PRO", "MAX"].map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
              <button onClick={() => { setCreditModal({ userId: u.id, email: u.email }); setCreditDelta("0"); }}
                className="rounded-lg bg-surface border border-borderDefault px-2 py-1.5 text-[11px] font-medium text-muted hover:text-primary transition">
                Credits
              </button>
              {u.role !== "SUPER_ADMIN" && (
                <button onClick={() => updateRole(u.id, "SUPER_ADMIN")} className="rounded-lg bg-rose-500/10 px-2 py-1.5 text-[11px] font-semibold text-rose-400 hover:bg-rose-500/20 transition">
                  Super Admin
                </button>
              )}
              {u.role !== "ADMIN" && u.role !== "SUPER_ADMIN" && (
                <button onClick={() => updateRole(u.id, "ADMIN")} className="rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/20 transition">
                  Admin
                </button>
              )}
              {u.role !== "USER" && (
                <button onClick={() => updateRole(u.id, "USER")} className="rounded-lg bg-surface border border-borderDefault px-2 py-1.5 text-[11px] font-medium text-muted hover:text-primary transition">
                  User
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70" onClick={() => setCreditModal(null)}>
          <div className="card w-full max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[13px] font-semibold text-primary">Adjust credits</p>
            <p className="mt-0.5 text-[12px] text-muted">{creditModal.email}</p>
            <input type="number" value={creditDelta} onChange={(e) => setCreditDelta(e.target.value)} placeholder="+100 or -50"
              className="input mt-3 w-full" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setCreditModal(null)} className="btn-secondary text-[12px]">Cancel</button>
              <button onClick={adjustCredits} className="btn-primary text-[12px]">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
