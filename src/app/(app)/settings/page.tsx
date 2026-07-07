"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Lock, LockOpen, ShieldCheck } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export default function SettingsPage() {
  const { user, workspace, load, logout, encKey, enableEncryption, unlock, lock } = useAppStore();
  const router = useRouter();
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [saving, setSaving] = useState(false);
  const [encModal, setEncModal] = useState<null | "enable" | "unlock">(null);
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [encBusy, setEncBusy] = useState(false);

  async function submitEncryption() {
    setEncBusy(true);
    try {
      if (encModal === "enable") {
        if (pass1.length < 8) return toast.error("Passphrase must be at least 8 characters");
        if (pass1 !== pass2) return toast.error("Passphrases do not match");
        const ok = await enableEncryption(pass1);
        if (ok) {
          toast.success("Encryption enabled");
          setEncModal(null);
        } else toast.error("Failed to enable encryption");
      } else {
        const ok = await unlock(pass1);
        if (ok) {
          toast.success("Unlocked");
          setEncModal(null);
        } else toast.error("Wrong passphrase");
      }
    } finally {
      setEncBusy(false);
      setPass1("");
      setPass2("");
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (user) setName(user.name || "");
    if (workspace) setWorkspaceName(workspace.name || "");
  }, [user, workspace]);

  async function saveProfile() {
    setSaving(true);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, workspaceName }),
    });
    setSaving(false);
    if (res.ok) {
      await load();
      toast.success("Profile updated");
    } else {
      toast.error("Failed to update");
    }
  }

  async function togglePrivacy(value: boolean) {
    await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privacyMode: value }),
    });
    await load();
    toast.success(value ? "Privacy mode on - new chats won't be saved" : "Privacy mode off");
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  async function deleteAccount() {
    if (!confirm("Delete your account and all data? This cannot be undone.")) return;
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) {
      toast.success("Account deleted");
      router.replace("/");
    } else {
      toast.error("Failed to delete account");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-h1 text-grad-light">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your account.</p>
      </div>

      <div className="card mb-4 p-5">
        <p className="mb-4 text-[13px] font-semibold text-primary">Profile</p>
        <div className="grid gap-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" defaultValue={user?.email || ""} disabled />
          </div>
          <div>
            <label className="label">Workspace</label>
            <input className="input" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
          </div>
          <div>
            <button onClick={saveProfile} disabled={saving} className="btn-primary w-fit">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      <div className="card mb-4 flex items-center justify-between p-5">
        <div className="pr-4">
          <p className="text-[13px] font-semibold text-primary">Privacy mode (zero-retention)</p>
          <p className="text-xs text-muted">When on, new conversations are never stored on our servers.</p>
        </div>
        <button
          role="switch"
          aria-checked={Boolean(workspace?.privacyMode)}
          onClick={() => togglePrivacy(!workspace?.privacyMode)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
            workspace?.privacyMode ? "border-highlight bg-highlight" : "border-borderDefault bg-bgActive"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-bg transition ${
              workspace?.privacyMode ? "translate-x-[22px]" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="card mb-4 p-5">
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-primary">
              <ShieldCheck size={15} className="text-tertiary" /> End-to-end encryption
            </p>
            <p className="mt-1 text-xs text-muted">
              Encrypt conversations with a passphrase. We store only ciphertext - even we can&apos;t read it.
              If you lose the passphrase, the data is unrecoverable.
            </p>
          </div>
          {!workspace?.encEnabled ? (
            <button onClick={() => setEncModal("enable")} className="btn-secondary shrink-0">Enable</button>
          ) : encKey ? (
            <button onClick={lock} className="btn-secondary shrink-0">
              <LockOpen size={14} /> Unlocked
            </button>
          ) : (
            <button onClick={() => setEncModal("unlock")} className="btn-primary shrink-0">
              <Lock size={14} /> Unlock
            </button>
          )}
        </div>
        {workspace?.encEnabled && (
          <p className="mt-3 text-[11px] text-tertiary">
            Status: {encKey ? "unlocked on this device" : "locked - unlock to read/write encrypted chats"}
          </p>
        )}
      </div>

      <div className="card mb-4 flex items-center justify-between p-5">
        <div>
          <p className="text-[13px] font-semibold text-primary">Privacy policy & security</p>
          <p className="text-xs text-muted">How we handle (and don&apos;t store) your data.</p>
        </div>
        <Link href="/privacy" className="btn-secondary">View</Link>
      </div>

      <div className="card mb-4 flex items-center justify-between p-5">
        <div>
          <p className="text-[13px] font-semibold text-primary">Sign out</p>
          <p className="text-xs text-muted">End your session on this device.</p>
        </div>
        <button onClick={handleLogout} className="btn-secondary">Sign out</button>
      </div>

      <div className="card flex items-center justify-between border-danger/20 p-5">
        <div>
          <p className="text-[13px] font-semibold text-danger">Delete account</p>
          <p className="text-xs text-muted">Permanently remove your account and data.</p>
        </div>
        <button onClick={deleteAccount} className="btn-danger">Delete</button>
      </div>

      {encModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEncModal(null)}>
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-card border border-borderDefault bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-h2 text-primary">
              {encModal === "enable" ? "Enable encryption" : "Unlock encryption"}
            </p>
            <p className="mb-4 mt-1 text-xs text-muted">
              {encModal === "enable"
                ? "Choose a passphrase. It never leaves your device. If you lose it, encrypted chats are gone forever."
                : "Enter your passphrase to read and write encrypted conversations on this device."}
            </p>
            <label className="label">Passphrase</label>
            <input
              type="password"
              className="input"
              value={pass1}
              onChange={(e) => setPass1(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && encModal === "unlock" && submitEncryption()}
            />
            {encModal === "enable" && (
              <>
                <label className="label mt-3">Confirm passphrase</label>
                <input type="password" className="input" value={pass2} onChange={(e) => setPass2(e.target.value)} />
              </>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEncModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={submitEncryption} disabled={encBusy} className="btn-primary">
                {encBusy ? "Working…" : encModal === "enable" ? "Enable" : "Unlock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
