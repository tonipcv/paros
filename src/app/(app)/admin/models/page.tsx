"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Activity, Boxes, ChevronDown, ChevronRight, Database, RefreshCw, Route, Search, Server, Star } from "lucide-react";
import { Badge, Button, EmptyState, Input, Modal, PageContainer, PageHeader, PageSkeleton, StatCard, Switch, Textarea } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

type Price = { id: string; unit: string; usd: string };
type ModelRoute = { id: string; providerModelId: string; status: string; priority: number; weight: number; latencyMs: number | null; errorRate: number; lastError: string | null; provider: { id: string; slug: string; name: string; enabled: boolean }; prices: Price[] };
type CatalogModel = { id: string; publicId: string; name: string; description: string; author: string; modality: string; status: string; contextTokens: number | null; maxOutputTokens: number | null; credits: number; featured: boolean; sortOrder: number; capabilities: Record<string, unknown> | null; aliases: { id: string; alias: string }[]; routes: ModelRoute[] };
type Provider = { id: string; slug: string; name: string; kind: string; baseUrl: string | null; enabled: boolean; priority: number; zeroRetention: boolean; lastSyncedAt: string | null; _count: { routes: number } };
type SyncRun = { id: string; status: string; discovered: number; created: number; updated: number; disabled: number; error: string | null; startedAt: string; completedAt: string | null; provider: { slug: string; name: string } };
type CatalogResponse = { total: number; filteredTotal: number; page: number; pages: number; models: CatalogModel[]; providers: Provider[]; recentSyncs: SyncRun[]; unhealthyRoutes: number; byStatus: { status: string; _count: { _all: number } }[] };

const MODALITIES = ["", "TEXT", "IMAGE", "VIDEO", "AUDIO", "EMBEDDING", "MUSIC", "UPSCALE", "INPAINT", "ASR", "TTS"];
const MODEL_STATUSES = ["DRAFT", "ACTIVE", "DEGRADED", "OFFLINE", "DEPRECATED"];
const ROUTE_STATUSES = ["ACTIVE", "DEGRADED", "OFFLINE", "DISABLED"];

function badgeVariant(status: string): "default" | "success" | "warning" | "danger" | "accent" {
  if (status === "ACTIVE" || status === "SUCCEEDED") return "success";
  if (status === "DEGRADED" || status === "RUNNING" || status === "PARTIAL") return "warning";
  if (status === "OFFLINE" || status === "FAILED") return "danger";
  return "default";
}

function when(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Never";
}

export default function ModelCatalogAdmin() {
  const { user, loaded } = useAppStore();
  const router = useRouter();
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [search, setSearch] = useState("");
  const [modality, setModality] = useState("");
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<CatalogModel | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (loaded && user?.role !== "SUPER_ADMIN") router.replace(user?.role === "ADMIN" ? "/admin" : "/chat");
  }, [loaded, user, router]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (search.trim()) params.set("search", search.trim());
    if (modality) params.set("modality", modality);
    if (status) params.set("status", status);
    if (provider) params.set("provider", provider);
    const response = await fetch(`/api/admin/model-catalog?${params}`, { cache: "no-store" });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not load model catalog");
    setData(await response.json());
  }, [page, search, modality, status, provider]);

  useEffect(() => {
    const timer = window.setTimeout(() => load().catch((cause) => toast.error(cause.message)), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  useEffect(() => setPage(1), [search, modality, status, provider]);

  async function mutate(path: string, body: Record<string, unknown>, success: string) {
    setBusy(path);
    const response = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || "Update failed");
    toast.success(success);
    await load();
  }

  async function sync(source: "all" | "openrouter" | "bundled") {
    setSyncing(true);
    const response = await fetch("/api/admin/model-catalog/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) });
    setSyncing(false);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || "Synchronization failed");
    toast.success(`${source} catalog synchronized`);
    await load();
  }

  const active = useMemo(() => data?.byStatus.find((item) => item.status === "ACTIVE")?._count._all || 0, [data]);
  if (loaded && user?.role !== "SUPER_ADMIN") return null;

  return (
    <PageContainer width="wide">
      <PageHeader title="Model catalog" description="Manage availability, routing and provider synchronization from one place." actions={
        <>
          <Button variant="secondary" onClick={() => sync("bundled")} disabled={syncing}>Bundled</Button>
          <Button onClick={() => sync("all")} disabled={syncing}><RefreshCw size={14} className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing…" : "Sync all"}</Button>
        </>
      } />

      {!data ? <PageSkeleton /> : <>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Boxes} label="Catalog models" value={data.total.toLocaleString()} />
          <StatCard icon={Activity} label="Active models" value={active.toLocaleString()} />
          <StatCard icon={Server} label="Providers" value={data.providers.length} />
          <StatCard icon={Route} label="Unhealthy routes" value={data.unhealthyRoutes} />
        </div>

        <section className="mt-9">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-h3 text-primary">Providers</h2><p className="mt-1 text-caption text-muted">Global provider controls affect every route using that provider.</p></div>
            <Button variant="secondary" onClick={() => sync("openrouter")} disabled={syncing}>Sync OpenRouter</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.providers.map((item) => <div key={item.id} className="rounded-card border border-borderDefault bg-bgCard p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-body font-medium text-primary">{item.name}</p><p className="mt-0.5 truncate text-caption text-muted">{item.slug} · {item._count.routes} routes</p></div><Switch checked={item.enabled} disabled={busy !== null} label={`Enable ${item.name}`} onChange={(enabled) => mutate(`/api/admin/model-catalog/providers/${item.id}`, { enabled }, `${item.name} ${enabled ? "enabled" : "disabled"}`)} /></div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-caption text-muted">Priority<input className="input mt-1 h-8" type="number" min="0" defaultValue={item.priority} onBlur={(event) => Number(event.target.value) !== item.priority && mutate(`/api/admin/model-catalog/providers/${item.id}`, { priority: Number(event.target.value) }, "Provider priority updated")} /></label>
                <div><p className="text-caption text-muted">Zero retention</p><div className="mt-2"><Switch checked={item.zeroRetention} disabled={busy !== null} label={`Zero retention for ${item.name}`} onChange={(zeroRetention) => mutate(`/api/admin/model-catalog/providers/${item.id}`, { zeroRetention }, "Retention policy updated")} /></div></div>
              </div>
              <p className="mt-3 text-[11px] text-tertiary">Last sync: {when(item.lastSyncedAt)}</p>
            </div>)}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4"><h2 className="text-h3 text-primary">Models</h2><p className="mt-1 text-caption text-muted">{data.filteredTotal.toLocaleString()} matching models · page {data.page} of {data.pages}</p></div>
          <div className="grid gap-2 md:grid-cols-[minmax(260px,1fr)_160px_160px_180px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" size={15} /><Input aria-label="Search models" className="pl-9" placeholder="Search ID, name or author" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <select aria-label="Filter modality" className="input" value={modality} onChange={(event) => setModality(event.target.value)}>{MODALITIES.map((value) => <option key={value || "all"} value={value}>{value || "All modalities"}</option>)}</select>
            <select aria-label="Filter status" className="input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{MODEL_STATUSES.map((value) => <option key={value}>{value}</option>)}</select>
            <select aria-label="Filter provider" className="input" value={provider} onChange={(event) => setProvider(event.target.value)}><option value="">All providers</option>{data.providers.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select>
          </div>

          <div className="mt-4 overflow-hidden rounded-card border border-borderDefault">
            {data.models.length === 0 ? <EmptyState icon={Database} title="No models found" description="Change the filters or synchronize a provider." /> : data.models.map((model) => <div key={model.id} className="border-b border-borderDefault last:border-b-0">
              <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <button className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => setExpanded(expanded === model.id ? null : model.id)}>
                  {expanded === model.id ? <ChevronDown className="mt-0.5 shrink-0 text-tertiary" size={16} /> : <ChevronRight className="mt-0.5 shrink-0 text-tertiary" size={16} />}
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-body font-medium text-primary">{model.name}</p>{model.featured && <Star size={13} className="fill-warning text-warning" />}<Badge variant={badgeVariant(model.status)}>{model.status}</Badge><Badge>{model.modality}</Badge></div><p className="mt-1 truncate font-mono text-[11px] text-muted">{model.publicId}</p></div>
                </button>
                <div className="flex flex-wrap items-center gap-2 pl-7 lg:pl-0"><span className="text-caption text-muted">{model.credits} credits · {model.routes.length} routes</span><Button variant="secondary" className="h-8 px-3 text-[12px]" onClick={() => setEditing(model)}>Edit</Button><Switch checked={model.status === "ACTIVE"} disabled={busy !== null} label={`Activate ${model.name}`} onChange={(checked) => mutate(`/api/admin/model-catalog/${model.id}`, { status: checked ? "ACTIVE" : "OFFLINE" }, `${model.name} ${checked ? "activated" : "taken offline"}`)} /></div>
              </div>
              {expanded === model.id && <div className="border-t border-borderDefault bg-bgPage/40 px-4 py-4 lg:pl-12">
                <div className="mb-4 flex flex-wrap gap-2">{Object.entries(model.capabilities || {}).filter(([key, value]) => !["id", "modelId", "createdAt", "updatedAt"].includes(key) && value === true).map(([key]) => <Badge key={key} variant="accent">{key}</Badge>)}{model.aliases.map((alias) => <Badge key={alias.id}>alias: {alias.alias}</Badge>)}</div>
                {model.routes.length === 0 ? <p className="text-caption text-muted">No provider routes configured.</p> : <div className="space-y-3">{model.routes.map((route) => <div key={route.id} className="grid gap-3 rounded-lg border border-borderDefault p-3 md:grid-cols-[minmax(180px,1fr)_150px_110px_110px] md:items-end">
                  <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-[13px] font-medium text-primary">{route.provider.name}</p><Badge variant={badgeVariant(route.status)}>{route.status}</Badge></div><p className="mt-1 truncate font-mono text-[10px] text-muted">{route.providerModelId}</p>{route.prices.length > 0 && <p className="mt-1 text-[10px] text-tertiary">{route.prices.map((price) => `${price.unit}: $${price.usd}`).join(" · ")}</p>}{route.lastError && <p className="mt-1 line-clamp-2 text-[10px] text-danger">{route.lastError}</p>}</div>
                  <label className="text-caption text-muted">Status<select className="input mt-1 h-8" value={route.status} onChange={(event) => mutate(`/api/admin/model-catalog/routes/${route.id}`, { status: event.target.value }, "Route status updated")}>{ROUTE_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label className="text-caption text-muted">Priority<input className="input mt-1 h-8" type="number" min="0" defaultValue={route.priority} onBlur={(event) => Number(event.target.value) !== route.priority && mutate(`/api/admin/model-catalog/routes/${route.id}`, { priority: Number(event.target.value) }, "Route priority updated")} /></label>
                  <label className="text-caption text-muted">Weight<input className="input mt-1 h-8" type="number" min="0" defaultValue={route.weight} onBlur={(event) => Number(event.target.value) !== route.weight && mutate(`/api/admin/model-catalog/routes/${route.id}`, { weight: Number(event.target.value) }, "Route weight updated")} /></label>
                </div>)}</div>}
              </div>}
            </div>)}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="secondary" disabled={page >= data.pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
        </section>

        <section className="mt-10"><h2 className="text-h3 text-primary">Recent synchronizations</h2><div className="mt-3">{data.recentSyncs.map((run) => <div key={run.id} className="flex flex-col gap-2 border-t border-borderDefault py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="text-[13px] font-medium text-primary">{run.provider.name}</p><Badge variant={badgeVariant(run.status)}>{run.status}</Badge></div><p className="mt-1 text-[11px] text-muted">{run.discovered} discovered · {run.created} created · {run.updated} updated · {run.disabled} disabled{run.error ? ` · ${run.error}` : ""}</p></div><span className="text-caption text-muted">{when(run.startedAt)}</span></div>)}</div></section>
      </>}

      <ModelEditor model={editing} busy={busy !== null} onClose={() => setEditing(null)} onSave={async (body) => { if (!editing) return; await mutate(`/api/admin/model-catalog/${editing.id}`, body, "Model updated"); setEditing(null); }} />
    </PageContainer>
  );
}

function ModelEditor({ model, busy, onClose, onSave }: { model: CatalogModel | null; busy: boolean; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  useEffect(() => { if (model) setForm({ name: model.name, description: model.description, author: model.author, modality: model.modality, status: model.status, credits: String(model.credits), sortOrder: String(model.sortOrder), contextTokens: model.contextTokens?.toString() || "", maxOutputTokens: model.maxOutputTokens?.toString() || "", featured: model.featured }); }, [model]);
  const field = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  return <Modal open={model !== null} onClose={onClose} title={`Edit ${model?.name || "model"}`} width="max-w-2xl" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={() => onSave({ ...form, credits: Number(form.credits), sortOrder: Number(form.sortOrder), contextTokens: form.contextTokens === "" ? null : Number(form.contextTokens), maxOutputTokens: form.maxOutputTokens === "" ? null : Number(form.maxOutputTokens) })}>{busy ? "Saving…" : "Save changes"}</Button></>}>
    <div className="grid gap-4 sm:grid-cols-2"><label className="label sm:col-span-2">Name<Input className="mt-1" value={String(form.name || "")} onChange={(event) => field("name", event.target.value)} /></label><label className="label">Author<Input className="mt-1" value={String(form.author || "")} onChange={(event) => field("author", event.target.value)} /></label><label className="label">Status<select className="input mt-1" value={String(form.status || "ACTIVE")} onChange={(event) => field("status", event.target.value)}>{MODEL_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label><label className="label">Modality<select className="input mt-1" value={String(form.modality || "TEXT")} onChange={(event) => field("modality", event.target.value)}>{MODALITIES.filter(Boolean).map((value) => <option key={value}>{value}</option>)}</select></label><label className="label">Credits<Input className="mt-1" type="number" min="0" value={String(form.credits || "0")} onChange={(event) => field("credits", event.target.value)} /></label><label className="label">Context tokens<Input className="mt-1" type="number" min="1" value={String(form.contextTokens || "")} onChange={(event) => field("contextTokens", event.target.value)} /></label><label className="label">Max output tokens<Input className="mt-1" type="number" min="1" value={String(form.maxOutputTokens || "")} onChange={(event) => field("maxOutputTokens", event.target.value)} /></label><label className="label">Sort order<Input className="mt-1" type="number" value={String(form.sortOrder || "0")} onChange={(event) => field("sortOrder", event.target.value)} /></label><div className="flex items-end gap-3 pb-2"><Switch checked={Boolean(form.featured)} label="Featured model" onChange={(value) => field("featured", value)} /><span className="text-caption text-muted">Featured model</span></div><label className="label sm:col-span-2">Description<Textarea className="mt-1" value={String(form.description || "")} onChange={(event) => field("description", event.target.value)} /></label></div>
  </Modal>;
}
