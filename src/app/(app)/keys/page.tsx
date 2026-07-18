"use client";

import { useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageContainer, PageHeader } from "@/components/ui";

type Key = { id: string; name: string; keyPrefix: string; lastUsedAt: string | null; createdAt: string };

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3014";

export default function KeysPage() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const res = await fetch("/api/keys");
    if (res.ok) setKeys((await res.json()).keys);
  }

  async function create() {
    setCreating(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "API Key" }),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      setNewKey(data.key);
      setName("");
      refresh();
    } else {
      toast.error("Failed to create key");
    }
  }

  async function remove(id: string) {
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    refresh();
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <PageContainer width="default">
      <PageHeader
        title="API Keys"
        description="OpenAI compatible. Use with any SDK."
        actions={<a href="/docs" target="_blank" className="btn-secondary">API docs</a>}
      />

      {newKey && (
        <div className="border-t border-borderDefault py-8 first:border-t-0 first:pt-0">
          <p className="text-body font-medium text-primary">Your new API key. Copy it now — it won&apos;t be shown again.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-btn border border-borderDefault bg-bg px-3 py-2 text-[12px] text-silver">
              {newKey}
            </code>
            <button onClick={copyKey} className="btn-secondary">
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <div className="border-t border-borderDefault first:border-t-0 first:pt-0">
          <EmptyState icon={KeyRound} title="No API keys yet" description="Create a key when you are ready to connect an external client." />
        </div>
      ) : (
        <div className="border-t border-borderDefault first:border-t-0 first:pt-0">
          <div className="divide-y divide-borderDefault">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-primary">{k.name}</p>
                  <p className="text-[11px] text-tertiary">{k.keyPrefix}••••••</p>
                </div>
                <button onClick={() => remove(k.id)} aria-label={`Delete key ${k.name}`} className="btn-ghost text-tertiary hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="grid gap-6 border-t border-borderDefault py-8 first:border-t-0 first:pt-0 sm:grid-cols-[260px_1fr]">
        <div>
          <h2 className="text-h3 text-primary">Create a key</h2>
          <p className="mt-1 text-caption leading-5 text-muted">Keys authenticate requests to the Venice API.</p>
        </div>
        <div className="min-w-0">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label" htmlFor="key-name">Key name</label>
              <input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production key"
                className="input"
              />
            </div>
            <button onClick={create} disabled={creating} className="btn-primary">
              <Plus size={15} /> Create
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 border-t border-borderDefault py-8 first:border-t-0 first:pt-0 sm:grid-cols-[260px_1fr]">
        <div>
          <h2 className="text-h3 text-primary">Example usage</h2>
          <p className="mt-1 text-caption leading-5 text-muted">OpenAI-compatible &mdash; use the Venice API with any SDK.</p>
        </div>
        <div className="min-w-0">
          <pre className="overflow-auto rounded-btn border border-borderDefault bg-bg p-3 text-[12px] text-silver">
{`curl ${appUrl}/api/v1/chat/completions \\
  -H "Authorization: Bearer nb-..." \\
  -H "Content-Type: application/json" \\
  -d '{"model":"meta-llama/llama-3.3-70b-instruct",
       "messages":[{"role":"user","content":"Hello"}]}'`}
          </pre>
        </div>
      </section>
    </PageContainer>
  );
}
