"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Lock, LockOpen, Flame } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { Button, Input, Modal, PageContainer, PageHeader, Switch } from "@/components/ui";

function Section({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section className="grid gap-6 border-t border-borderDefault py-8 first:border-t-0 first:pt-0 sm:grid-cols-[260px_1fr]">
      <div>
        <h2 className={`text-h3 ${danger ? "text-danger" : "text-primary"}`}>{title}</h2>
        {description ? <p className="mt-1 text-caption leading-5 text-muted">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [rawDefault, setRawDefault] = useState(true);

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
    try { setRawDefault(localStorage.getItem("htps_raw") !== "off"); } catch {}
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
    toast.success(value ? "Privacy mode on. New chats will not be saved." : "Privacy mode off");
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  async function deleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account", { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      toast.success("Account deleted");
      router.replace("/");
    } else {
      toast.error("Failed to delete account");
    }
  }

  const deleteMatches = deleteConfirm.trim().toLowerCase() === (user?.email || "").toLowerCase();

  return (
    <PageContainer width="default">
      <PageHeader title="Settings" description="Manage your account and workspace." />

      <Section title="Profile" description="Your name and workspace identity.">
        <div className="grid max-w-md gap-4">
          <div>
            <label className="label" htmlFor="settings-name">Name</label>
            <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="settings-email">Email</label>
            <Input id="settings-email" defaultValue={user?.email || ""} disabled />
          </div>
          <div>
            <label className="label" htmlFor="settings-workspace">Workspace</label>
            <Input id="settings-workspace" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
          </div>
          <div>
            <Button onClick={saveProfile} disabled={saving} className="w-fit">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Privacy mode" description="When on, new conversations are never stored on our servers.">
        <div className="flex items-center justify-between">
          <p className="text-body text-secondary">Zero-retention for new chats</p>
          <Switch checked={Boolean(workspace?.privacyMode)} onChange={togglePrivacy} label="Privacy mode" />
        </div>
      </Section>

      <Section title="Content defaults" description="How new conversations behave by default. You can override per-conversation in the chat header.">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-body text-secondary">Raw mode as default</p>
            <p className="text-caption text-muted">
              {rawDefault
                ? "New chats start with no system prompt. Models have full creative freedom."
                : "New chats use the default helpful assistant system prompt."}
            </p>
          </div>
          <button
            onClick={() => {
              const next = !rawDefault;
              setRawDefault(next);
              try { localStorage.setItem("htps_raw", next ? "on" : "off"); } catch {}
              toast.success(next ? "Raw mode is now on by default" : "Default system prompt restored");
            }}
            title={rawDefault ? "Disable raw mode" : "Enable raw mode"}
            aria-label={rawDefault ? "Disable raw mode" : "Enable raw mode"}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-btn border transition ${
              rawDefault
                ? "border-orange-500/50 bg-orange-500/10 text-orange-500"
                : "border-borderDefault text-secondary hover:border-borderHover hover:text-primary"
            }`}
          >
            <Flame size={14} />
          </button>
        </div>
      </Section>

      <Section
        title="End-to-end encryption"
        description="Encrypt conversations with a passphrase. We store only ciphertext; if you lose the passphrase, the data is unrecoverable."
      >
        <div className="flex items-center justify-between">
          <p className="text-body text-secondary">
            {!workspace?.encEnabled
              ? "Encryption is not enabled"
              : encKey
                ? "Unlocked on this device"
                : "Locked. Unlock to read and write encrypted chats"}
          </p>
          {!workspace?.encEnabled ? (
            <Button variant="secondary" onClick={() => setEncModal("enable")} className="shrink-0">Enable</Button>
          ) : encKey ? (
            <Button variant="secondary" onClick={lock} className="shrink-0">
              <LockOpen size={14} /> Lock
            </Button>
          ) : (
            <Button onClick={() => setEncModal("unlock")} className="shrink-0">
              <Lock size={14} /> Unlock
            </Button>
          )}
        </div>
      </Section>

      <Section title="About" description="How we handle (and don't store) your data.">
        <Link href="/privacy" className="text-body font-medium text-primary hover:underline">
          Read the privacy policy
        </Link>
      </Section>

      <Section title="Session" description="End your session on this device.">
        <Button variant="secondary" onClick={handleLogout}>Sign out</Button>
      </Section>

      <Section title="Delete account" description="Permanently remove your account, workspace, and all associated data. This cannot be undone." danger>
        <Button variant="danger" onClick={() => { setDeleteConfirm(""); setDeleteOpen(true); }}>Delete account</Button>
      </Section>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete account"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={deleteAccount} disabled={!deleteMatches || deleting}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </>
        }
      >
        <p className="text-body text-muted">
          This permanently deletes your account, workspace, and all associated data. This cannot be undone.
        </p>
        <label className="label mt-4" htmlFor="delete-confirm">
          Type <span className="font-medium text-primary">{user?.email}</span> to confirm
        </label>
        <Input
          id="delete-confirm"
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder={user?.email || ""}
          autoComplete="off"
        />
      </Modal>

      <Modal
        open={encModal !== null}
        onClose={() => setEncModal(null)}
        title={encModal === "enable" ? "Enable encryption" : "Unlock encryption"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEncModal(null)}>Cancel</Button>
            <Button onClick={submitEncryption} disabled={encBusy}>
              {encBusy ? "Working…" : encModal === "enable" ? "Enable" : "Unlock"}
            </Button>
          </>
        }
      >
        <p className="text-caption text-muted">
          {encModal === "enable"
            ? "Choose a passphrase. It never leaves your device. If you lose it, encrypted chats are gone forever."
            : "Enter your passphrase to read and write encrypted conversations on this device."}
        </p>
        <label className="label mt-4" htmlFor="enc-pass">Passphrase</label>
        <Input
          id="enc-pass"
          type="password"
          value={pass1}
          onChange={(e) => setPass1(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && encModal === "unlock" && submitEncryption()}
        />
        {encModal === "enable" && (
          <>
            <label className="label mt-3" htmlFor="enc-pass2">Confirm passphrase</label>
            <Input id="enc-pass2" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
          </>
        )}
      </Modal>
    </PageContainer>
  );
}
