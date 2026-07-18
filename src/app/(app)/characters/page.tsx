"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { Button, EmptyState, Input, Modal, PageContainer, PageHeader, Textarea } from "@/components/ui";

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
    <PageContainer width="wide">
      <PageHeader
        title="Characters"
        description="Custom AI personalities you can chat with."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} /> New character
          </Button>
        }
      />

      {characters.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No characters yet"
          description="Create one when you need a reusable personality or workflow."
          action={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={15} /> New character</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((c) => (
            <div
              key={c.id}
              className="card relative flex flex-col p-5 transition hover:border-borderHover hover:shadow-card-hover"
            >
              <button onClick={() => chatWith(c.id)} className="flex flex-1 flex-col text-left">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-bgActive text-[15px] font-semibold text-primary">
                  {avatarInitial(c.name)}
                </div>
                <p className="mt-3 text-[15px] font-semibold text-primary">{c.name}</p>
                <p className="text-[12px] text-muted">{c.tagline || "AI character"}</p>
                <p className="mt-2 line-clamp-2 flex-1 text-[12px] text-tertiary">{c.systemPrompt}</p>
              </button>
              <button
                onClick={(e) => remove(c.id, e)}
                aria-label={`Delete ${c.name}`}
                className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-btn text-tertiary transition hover:bg-bgHover hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New character"
        width="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>
              {saving ? "Creating…" : "Create character"}
            </Button>
          </>
        }
      >
        <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
          <div>
            <label className="label" htmlFor="char-name">Name *</label>
            <Input id="char-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Sherlock Holmes" />
          </div>
          <div>
            <label className="label" htmlFor="char-tagline">Tagline</label>
            <Input id="char-tagline" value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} placeholder="The world's greatest detective" />
          </div>
          <div>
            <label className="label" htmlFor="char-prompt">Personality (system prompt) *</label>
            <Textarea id="char-prompt" className="min-h-[100px]" value={form.systemPrompt} onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))} placeholder="You are Sherlock Holmes, a brilliant detective. You speak with wit and deductive reasoning…" />
          </div>
          <div>
            <label className="label" htmlFor="char-greeting">Greeting (optional)</label>
            <Textarea id="char-greeting" className="min-h-[60px]" value={form.greeting} onChange={(e) => setForm((f) => ({ ...f, greeting: e.target.value }))} placeholder="Ah, a new case! Do come in and tell me everything." />
          </div>
          <div>
            <label className="label" htmlFor="char-model">Default model</label>
            <select id="char-model" className="input" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}>
              <option value="">Workspace default</option>
              {chatModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
