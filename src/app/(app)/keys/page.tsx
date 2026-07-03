"use client";

import { useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

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
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-h1 text-grad-light">API Keys</h1>
          <p className="mt-1 text-sm text-muted">OpenAI-compatible. Use with any SDK.</p>
        </div>
        <a href="/docs" target="_blank" className="btn-secondary">API docs</a>
      </div>

      {newKey && (
        <div className="card mb-5 border-highlight/30 p-4">
          <p className="mb-2 text-[13px] font-medium text-primary">Your new API key (copy it now — shown once)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-btn border border-borderDefault bg-bg px-3 py-2 text-[12px] text-silver">
              {newKey}
            </code>
            <button onClick={copyKey} className="btn-secondary h-9 px-3">
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      )}

      <div className="card mb-6 p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label">Key name</label>
            <input
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

      <div className="card divide-y divide-borderDefault p-0">
        {keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <KeyRound size={22} className="mb-2 text-tertiary" />
            <p className="text-sm text-muted">No API keys yet</p>
          </div>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-primary">{k.name}</p>
                <p className="text-[11px] text-tertiary">{k.keyPrefix}••••••</p>
              </div>
              <button onClick={() => remove(k.id)} className="btn-ghost text-tertiary hover:text-danger">
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="card mt-6 p-5">
        <p className="mb-2 text-[13px] font-medium text-primary">Example usage</p>
        <pre className="overflow-auto rounded-btn border border-borderDefault bg-bg p-3 text-[12px] text-silver">
{`curl ${appUrl}/api/v1/chat/completions \\
  -H "Authorization: Bearer nb-..." \\
  -H "Content-Type: application/json" \\
  -d '{"model":"meta-llama/llama-3.3-70b-instruct",
       "messages":[{"role":"user","content":"Hello"}]}'`}
        </pre>
      </div>
    </div>
  );
}
