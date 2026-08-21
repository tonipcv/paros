"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, DollarSign, Download } from "lucide-react";
import { Badge, Input, PageContainer, PageHeader, PageSkeleton, StatCard } from "@/components/ui";

type PlanEconomics = { plan: string; marginPct: number | null };
type ModelEconomics = {
  model: string; name: string; modality: string; provider: string | null; pricingStatus: string;
  pricing: Array<{ unit: string; usd: number }>; currentCredits: number; scenarioAdjustedCogsUsd: number | null;
  recommendedDynamicCredits: number | null; plans: PlanEconomics[]; pricingSources: string[];
};
type ResponseData = { generatedAt: string; summary: { models: number; priced: number; unpriced: number }; data: ModelEconomics[] };

const money = (value: number | null) => value === null ? "—" : `$${value.toFixed(value < 0.1 ? 4 : 2)}`;
const margin = (row: ModelEconomics, plan: string) => row.plans.find((item) => item.plan === plan)?.marginPct ?? null;

export default function UnitEconomicsPage() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [search, setSearch] = useState("");
  const [onlyRisk, setOnlyRisk] = useState(false);

  useEffect(() => { fetch("/api/admin/unit-economics/models", { cache: "no-store" }).then((response) => response.json()).then(setData); }, []);
  const rows = useMemo(() => (data?.data || []).filter((row) => {
    const matches = !search || `${row.model} ${row.name} ${row.provider} ${row.modality}`.toLowerCase().includes(search.toLowerCase());
    const isRisk = row.pricingStatus === "UNPRICED" || (margin(row, "MAX") ?? 100) < 75;
    return matches && (!onlyRisk || isRisk);
  }), [data, search, onlyRisk]);

  return <PageContainer width="wide">
    <PageHeader title="Unit economics" description="Supplier cost, credits and inference margin by model and plan." actions={
      <a className="inline-flex h-9 items-center gap-2 rounded-lg border border-borderDefault px-3 text-[13px] text-primary hover:bg-bgCard" href="/api/admin/unit-economics/models?format=csv"><Download size={14} />Export CSV</a>
    } />
    {!data ? <PageSkeleton /> : <>
      <div className="grid gap-6 sm:grid-cols-3">
        <StatCard icon={DollarSign} label="Active models" value={data.summary.models} />
        <StatCard icon={CheckCircle2} label="With supplier price" value={data.summary.priced} />
        <StatCard icon={AlertTriangle} label="Missing price" value={data.summary.unpriced} />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Input className="max-w-md" placeholder="Search model, provider or modality" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button className={`rounded-lg border px-3 text-[13px] ${onlyRisk ? "border-warning text-warning" : "border-borderDefault text-muted"}`} onClick={() => setOnlyRisk((value) => !value)}>Risks only</button>
      </div>
      <div className="mt-4 overflow-x-auto rounded-card border border-borderDefault">
        <table className="w-full min-w-[1050px] text-left text-[12px]">
          <thead className="border-b border-borderDefault bg-bgCard text-muted"><tr><th className="p-3">Model</th><th className="p-3">Supplier pricing</th><th className="p-3 text-right">Scenario COGS</th><th className="p-3 text-right">Current</th><th className="p-3 text-right">Dynamic</th><th className="p-3 text-right">Pro</th><th className="p-3 text-right">Pro+</th><th className="p-3 text-right">Max</th></tr></thead>
          <tbody>{rows.map((row) => {
            const maxMargin = margin(row, "MAX");
            return <tr key={row.model} className="border-b border-borderDefault last:border-0">
              <td className="p-3"><div className="flex items-center gap-2"><span className="font-medium text-primary">{row.name}</span><Badge>{row.modality}</Badge>{row.pricingStatus === "UNPRICED" && <Badge variant="danger">UNPRICED</Badge>}</div><div className="mt-1 font-mono text-[10px] text-muted">{row.model} · {row.provider}</div></td>
              <td className="p-3 text-muted">{row.pricing.length ? row.pricing.map((price) => <div key={price.unit}>{price.unit}: ${price.usd}</div>) : "No confirmed price"}{row.pricingSources[0] && <a className="mt-1 block text-accent hover:underline" href={row.pricingSources[0]} target="_blank" rel="noreferrer">Official source</a>}</td>
              <td className="p-3 text-right font-medium text-primary">{money(row.scenarioAdjustedCogsUsd)}</td>
              <td className="p-3 text-right">{row.currentCredits}</td><td className="p-3 text-right">{row.recommendedDynamicCredits ?? "—"}</td>
              {["STARTER", "PRO", "MAX"].map((plan) => { const value = margin(row, plan); return <td key={plan} className={`p-3 text-right font-medium ${value !== null && value < 75 ? "text-danger" : "text-primary"}`}>{value === null ? "—" : `${value.toFixed(1)}%`}</td>; })}
            </tr>;
          })}</tbody>
        </table>
      </div>
      <p className="mt-3 text-caption text-muted">Scenario: 2k input + 1k output tokens, 2MP image, 5s video at provider default resolution, 1 minute ASR, or 1k TTS characters. Red margin is below 75%.</p>
    </>}
  </PageContainer>;
}
