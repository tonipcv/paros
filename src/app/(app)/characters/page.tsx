"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Users } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";

type Character = {
  id: string;
  name: string;
  tagline: string;
  systemPrompt: string;
  greeting: string;
  model: string;
};

function avatarInitial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}

export default function CharactersPage() {
  const router = useRouter();
  const { chatModels, loadModels } = useAppStore();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    systemPrompt: "",
    greeting: "",
    model: "",
  });

  useEffect(() => {
    loadModels();
    refresh();
  }, []);

  async function refresh() {
    const res = await fetch("/api/characters");
    if (res.ok) setCharacters((await res.json()).characters);
  }

  async function create() {
    if (!form.name.trim() || !form.systemPrompt.trim()) {
      toast.error("Name and personality are required");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      setForm({ name: "", tagline: "", systemPrompt: "", greeting: "", model: "" });
      refresh();
      toast.success("Character created");
    } else {
      toast.error((await res.json()).error || "Failed");
    }
  }

  async function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/characters/${id}`, { method: "DELETE" });
    refresh();
  }

  function chatWith(id: string) {
    router.push(`/chat?character=${id}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-grad-light">Characters</h1>
          <p className="mt-1 text-sm text-muted">Custom AI personalities you can chat with.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Plus size={15} /> New character
        </button>
      </div>

      {characters.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-card border border-dashed border-borderDefault text-center">
          <Users size={26} className="mb-2 text-tertiary" />
          <p className="text-sm text-muted">No characters yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((c) => (
            <button
              key={c.id}
              onClick={() => chatWith(c.id)}
              className="card flex flex-col p-5 text-left transition hover:border-borderHover"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-bgActive text-[15px] font-semibold text-primary">
                  {avatarInitial(c.name)}
                </div>
                <span
                  onClick={(e) => remove(c.id, e)}
                  className="text-tertiary transition hover:text-danger"
                >
                  <Trash2 size={15} />
                </span>
              </div>
              <p className="mt-3 text-[15px] font-semibold text-primary">{c.name}</p>
              <p className="text-[12px] text-muted">{c.tagline || "AI character"}</p>
              <p className="mt-2 line-clamp-2 flex-1 text-[12px] text-tertiary">{c.systemPrompt}</p>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg rounded-card border border-borderDefault bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-h2 text-primary">New character</p>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-primary">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Sherlock Holmes" />
              </div>
              <div>
                <label className="label">Tagline</label>
                <input className="input" value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} placeholder="The world's greatest detective" />
              </div>
              <div>
                <label className="label">Personality (system prompt) *</label>
                <textarea className="input min-h-[100px] resize-y py-2" value={form.systemPrompt} onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))} placeholder="You are Sherlock Holmes, a brilliant detective. You speak with wit and deductive reasoning…" />
              </div>
              <div>
                <label className="label">Greeting (optional)</label>
                <textarea className="input min-h-[60px] resize-y py-2" value={form.greeting} onChange={(e) => setForm((f) => ({ ...f, greeting: e.target.value }))} placeholder="Ah, a new case! Do come in and tell me everything." />
              </div>
              <div>
                <label className="label">Default model</label>
                <select className="input" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}>
                  <option value="">Workspace default</option>
                  {chatModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={create} disabled={saving} className="btn-primary">
                {saving ? "Creating…" : "Create character"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
