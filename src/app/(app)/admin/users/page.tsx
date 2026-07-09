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
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role }),
    });
    if (res.ok) { setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u))); toast.success(`Updated to ${role}`); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); }
  }

  async function adjustCredits() {
    if (!creditModal) return;
    const delta = parseInt(creditDelta, 10);
    if (!Number.isInteger(delta)) return toast.error("Enter a whole number");
    const res = await fetch(`/api/admin/users/${creditModal.userId}/credits`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta }),
    });
    if (res.ok) { const d = await res.json(); setUsers((prev) => prev.map((u) => (u.id === creditModal.userId ? { ...u, workspace: { ...u.workspace!, credits: d.credits } } : u))); toast.success(`${d.email}: ${d.previous} → ${d.credits}`); setCreditModal(null); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); }
  }

  async function changePlan(userId: string, plan: string) {
    const res = await fetch(`/api/admin/users/${userId}/plan`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, grantCredits: true }),
    });
    if (res.ok) { const d = await res.json(); setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, workspace: { ...u.workspace!, plan: d.plan } } : u))); toast.success(`${d.email}: ${d.previous} → ${d.plan}`); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); }
  }

  const filtered = users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()) || (u.name || "").toLowerCase().includes(search.toLowerCase()));
  const roleColor = (r: string) => r === "SUPER_ADMIN" ? "text-rose-400" : r === "ADMIN" ? "text-amber-400" : "text-muted";

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-primary">Users</h1>
      <div className="mt-4">
        <input type="text" placeholder="Search by email or name..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full max-w-sm rounded-lg border border-borderDefault bg-surface px-3 text-sm text-primary outline-none placeholder:text-muted focus:border-borderHover" />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-borderDefault text-[11px] uppercase tracking-wide text-tertiary">
              <th className="px-3 py-2.5 font-medium">User</th>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="px-3 py-2.5 font-medium">Plan</th>
              <th className="px-3 py-2.5 font-medium">Credits</th>
              <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Verified</th>
              <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Joined</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borderDefault">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-bgHover">
                <td className="px-3 py-2.5"><p className="text-[13px] font-medium text-primary truncate max-w-[180px]">{u.email}</p>{u.name && <p className="text-[11px] text-muted truncate max-w-[180px]">{u.name}</p>}</td>
                <td className="px-3 py-2.5"><span className={`text-[12px] font-semibold ${roleColor(u.role)}`}>{u.role}</span></td>
                <td className="px-3 py-2.5 text-muted text-[12px]">{u.workspace?.plan || "FREE"}</td>
                <td className="px-3 py-2.5 text-muted text-[12px]">{u.workspace?.credits?.toLocaleString() ?? "0"}</td>
                <td className="px-3 py-2.5 hidden sm:table-cell">{u.emailVerified ? <span className="text-[11px] text-emerald-400">Yes</span> : <span className="text-[11px] text-muted">No</span>}</td>
                <td className="px-3 py-2.5 text-muted text-[11px] hidden sm:table-cell">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1.5 flex-wrap">
                    {u.role !== "SUPER_ADMIN" && <button onClick={() => updateRole(u.id, "SUPER_ADMIN")} className="rounded px-2 py-1 text-[10px] font-semibold bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition">Super Admin</button>}
                    {u.role !== "ADMIN" && u.role !== "SUPER_ADMIN" && <button onClick={() => updateRole(u.id, "ADMIN")} className="rounded px-2 py-1 text-[10px] font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition">Admin</button>}
                    {u.role !== "USER" && <button onClick={() => updateRole(u.id, "USER")} className="rounded px-2 py-1 text-[10px] font-semibold bg-gray-500/15 text-gray-400 hover:bg-gray-500/25 transition">User</button>}
                    <button onClick={() => { setCreditModal({ userId: u.id, email: u.email }); setCreditDelta("0"); }} className="rounded px-2 py-1 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition">Credits</button>
                    <select value={u.workspace?.plan || "FREE"} onChange={(e) => changePlan(u.id, e.target.value)} className="rounded px-1.5 py-1 text-[10px] font-semibold bg-surface border border-borderDefault text-muted">
                      {["FREE", "STARTER", "PRO", "MAX"].map((p) => (<option key={p} value={p}>{p}</option>))}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70" onClick={() => setCreditModal(null)}>
          <div className="card w-full max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-primary">Adjust credits</p>
            <p className="mt-0.5 text-[11px] text-muted">{creditModal.email}</p>
            <input type="number" value={creditDelta} onChange={(e) => setCreditDelta(e.target.value)} placeholder="e.g. +100 or -50"
              className="mt-3 h-10 w-full rounded-lg border border-borderDefault bg-surface px-3 text-sm text-primary outline-none placeholder:text-muted" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setCreditModal(null)} className="btn-secondary text-[12px] px-3 py-1.5">Cancel</button>
              <button onClick={adjustCredits} className="btn-primary text-[12px] px-3 py-1.5">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
