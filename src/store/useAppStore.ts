import { create } from "zustand";
import type { ChatModel } from "@/lib/models";
import { deriveKey, makeCheckBlob, randomSaltB64, verifyKey } from "@/lib/e2e";

type UserState = { id: string; name: string; email: string; role: string };
type WorkspaceState = {
  id: string;
  name: string;
  plan: string;
  credits: number;
  onboardingCompleted: boolean;
  privacyMode: boolean;
  encEnabled: boolean;
  encSalt: string | null;
  encCheckIv: string | null;
  encCheckCt: string | null;
};

type AppState = {
  user: UserState | null;
  workspace: WorkspaceState | null;
  chatModels: ChatModel[];
  loaded: boolean;
  encKey: CryptoKey | null;
  load: () => Promise<boolean>;
  loadModels: () => Promise<void>;
  setCredits: (credits: number) => void;
  logout: () => Promise<void>;
  enableEncryption: (passphrase: string) => Promise<boolean>;
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => void;
  tryAutoUnlock: () => Promise<void>;
};

const SS_KEY = "htps_enc_pass";

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  workspace: null,
  chatModels: [],
  loaded: false,
  encKey: null,
  async load() {
    try {
      const res = await fetch("/api/me");
      if (!res.ok) {
        set({ loaded: true, user: null, workspace: null });
        return false;
      }
      const data = await res.json();
      set({ user: data.user, workspace: data.workspace, loaded: true });
      await get().tryAutoUnlock();
      return true;
    } catch {
      set({ loaded: true });
      return false;
    }
  },
  async loadModels() {
    if (get().chatModels.length) return;
    const res = await fetch("/api/models");
    const data = await res.json();
    set({ chatModels: data.chat });
  },
  setCredits(credits) {
    const ws = get().workspace;
    if (ws) set({ workspace: { ...ws, credits } });
  },
  async logout() {
    try {
      sessionStorage.removeItem(SS_KEY);
    } catch {}
    await fetch("/api/logout", { method: "POST" });
    set({ user: null, workspace: null, encKey: null });
  },
  async enableEncryption(passphrase) {
    const salt = randomSaltB64();
    const key = await deriveKey(passphrase, salt);
    const check = await makeCheckBlob(key);
    const res = await fetch("/api/account/encryption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salt, checkIv: check.iv, checkCt: check.ct }),
    });
    if (!res.ok) return false;
    try {
      sessionStorage.setItem(SS_KEY, passphrase);
    } catch {}
    set({ encKey: key });
    const ws = get().workspace;
    if (ws) set({ workspace: { ...ws, encEnabled: true, encSalt: salt, encCheckIv: check.iv, encCheckCt: check.ct } });
    return true;
  },
  async unlock(passphrase) {
    const ws = get().workspace;
    if (!ws?.encEnabled || !ws.encSalt || !ws.encCheckIv || !ws.encCheckCt) return false;
    const key = await deriveKey(passphrase, ws.encSalt);
    const ok = await verifyKey(key, ws.encCheckIv, ws.encCheckCt);
    if (!ok) return false;
    try {
      sessionStorage.setItem(SS_KEY, passphrase);
    } catch {}
    set({ encKey: key });
    return true;
  },
  lock() {
    try {
      sessionStorage.removeItem(SS_KEY);
    } catch {}
    set({ encKey: null });
  },
  async tryAutoUnlock() {
    const ws = get().workspace;
    if (!ws?.encEnabled || get().encKey) return;
    try {
      const pass = sessionStorage.getItem(SS_KEY);
      if (pass) await get().unlock(pass);
    } catch {}
  },
}));
