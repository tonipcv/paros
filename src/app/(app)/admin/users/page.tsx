"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useRouter } from "next/navigation";
import { Badge, Button, EmptyState, Input, Modal, PageContainer, PageHeader, PageSkeleton } from "@/components/ui";

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
  const [users, setUsers] = useState<UserRecord[] | null>(null);
  const [search, setSearch] = useState("");
  const [creditModal, setCreditModal] = useState<{ userId: string; email: string } | null>(null);
  const [creditDelta, setCreditDelta] = useState("0");

  useEffect(() => {
    if (loaded && user && user.role === "USER") { router.replace("/chat"); return; }
  }, [loaded, user, router]);

  useEffect(() => {
    fetch("/api/admin/users").then((r) => r.json()).then((d) => setUsers(d.users)).catch(() => setUsers([]));
  }, []);

  async function updateRole(userId: string, role: string) {
    const res = await fetch(`/api/admin/users/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role }) });
    if (res.ok) { setUsers((prev) => prev?.map((u) => (u.id === userId ? { ...u, role } : u)) ?? prev); toast.success(`Updated to ${role}`); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); }
  }

  async function adjustCredits() {
    if (!creditModal) return;
    const delta = parseInt(creditDelta, 10);
    if (!Number.isInteger(delta)) return toast.error("Enter a whole number");
    const res = await fetch(`/api/admin/users/${creditModal.userId}/credits`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta }) });
    if (res.ok) { const d = await res.json(); setUsers((prev) => prev?.map((u) => (u.id === creditModal.userId ? { ...u, workspace: { ...u.workspace!, credits: d.credits } } : u)) ?? prev); toast.success(`${d.email}: ${d.previous} → ${d.credits}`); setCreditModal(null); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); }
  }

  async function changePlan(userId: string, plan: string) {
    const res = await fetch(`/api/admin/users/${userId}/plan`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, grantCredits: true }) });
    if (res.ok) { const d = await res.json(); setUsers((prev) => prev?.map((u) => (u.id === userId ? { ...u, workspace: { ...u.workspace!, plan: d.plan } } : u)) ?? prev); toast.success(`${d.email}: ${d.previous} → ${d.plan}`); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed"); }
  }

  const filtered = (users ?? []).filter((u) => u.email.toLowerCase().includes(search.toLowerCase()) || (u.name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <PageContainer width="wide">
      <PageHeader title="Users" description={users ? `${users.length} accounts` : "Manage accounts"} />

      {users === null ? (
        <PageSkeleton />
      ) : (
        <>
          <label className="sr-only" htmlFor="user-search">Search users</label>
          <Input id="user-search" type="text" placeholder="Search by email or name" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />

          {filtered.length === 0 ? (
            <EmptyState icon={Users} title="No users found" description={search ? "Try a different search." : undefined} />
          ) : (
            <div>
              {filtered.map((u) => (
                <div key={u.id} className="flex flex-col gap-3 border-t border-borderDefault py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-primary">{u.email}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge>{u.workspace?.plan || "FREE"}</Badge>
                      <Badge>{(u.workspace?.credits ?? 0).toLocaleString()} credits</Badge>
                      {u.role !== "USER" && <Badge variant="accent">{u.role}</Badge>}
                      {!u.emailVerified && <Badge variant="warning">Unverified</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="sr-only" htmlFor={`plan-${u.id}`}>Plan for {u.email}</label>
                    <select id={`plan-${u.id}`} value={u.workspace?.plan || "FREE"} onChange={(e) => changePlan(u.id, e.target.value)}
                      className="input h-8 w-auto px-2 text-[12px]">
                      {["FREE", "STARTER", "PRO", "MAX"].map((p) => (<option key={p} value={p}>{p}</option>))}
                    </select>
                    <Button variant="secondary" className="h-8 px-2.5 text-[12px]" onClick={() => { setCreditModal({ userId: u.id, email: u.email }); setCreditDelta("0"); }}>
                      Credits
                    </Button>
                    {u.role !== "SUPER_ADMIN" && (
                      <Button variant="secondary" className="h-8 px-2.5 text-[12px]" onClick={() => updateRole(u.id, "SUPER_ADMIN")}>
                        Super Admin
                      </Button>
                    )}
                    {u.role !== "ADMIN" && u.role !== "SUPER_ADMIN" && (
                      <Button variant="secondary" className="h-8 px-2.5 text-[12px]" onClick={() => updateRole(u.id, "ADMIN")}>
                        Admin
                      </Button>
                    )}
                    {u.role !== "USER" && (
                      <Button variant="secondary" className="h-8 px-2.5 text-[12px]" onClick={() => updateRole(u.id, "USER")}>
                        User
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        open={creditModal !== null}
        onClose={() => setCreditModal(null)}
        title="Adjust credits"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreditModal(null)}>Cancel</Button>
            <Button onClick={adjustCredits}>Apply</Button>
          </>
        }
      >
        <p className="text-caption text-muted">{creditModal?.email}</p>
        <label className="label mt-3" htmlFor="credit-delta">Credit delta</label>
        <Input id="credit-delta" type="number" value={creditDelta} onChange={(e) => setCreditDelta(e.target.value)} placeholder="+100 or -50" />
      </Modal>
    </PageContainer>
  );
}
