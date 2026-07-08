"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { annualMonthlyEquivalent, annualPlanPrice, formatPrice, PLANS, type BillingCycle } from "@/lib/models";
import { ExternalLink } from "lucide-react";

type HistoryData = {
  subscription: {
    status: string;
    plan: string;
    credits: number;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  invoices: {
    id: string;
    number: string;
    amount: number;
    currency: string;
    status: string;
    periodStart: string;
    periodEnd: string;
    pdfUrl: string;
    hostedUrl: string;
  }[];
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function BillingPage() {
  const { workspace, load } = useAppStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [history, setHistory] = useState<HistoryData | null>(null);

  useEffect(() => {
    fetch("/api/billing/history")
      .then((r) => r.json())
      .then(setHistory)
      .catch(() => {});
  }, []);

  const hasYearly = useMemo(() =>
    PLANS.some((p) => p.priceEnvYearly && process.env["NEXT_PUBLIC_" + p.priceEnvYearly]),
    []
  );

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) toast.success("Subscription active!");
    if (params.get("canceled")) toast.message("Checkout canceled");
  }, []);

  async function openPortal() {
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      window.location.href = data.url;
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Failed to open billing portal"));
    } finally {
      setLoading(null);
    }
  }

  async function subscribe(plan: string) {
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingCycle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      window.location.href = data.url;
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Failed to open checkout"));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-h1 text-grad-light">Billing</h1>
        <p className="mt-1 text-sm text-muted">
          Current plan: <span className="text-primary">{workspace?.plan || "FREE"}</span> ·{" "}
          {workspace?.credits?.toLocaleString() ?? 0} credits
        </p>
        {workspace?.plan && workspace.plan !== "FREE" && (
          <button onClick={openPortal} disabled={loading === "portal"} className="btn-secondary mt-3">
            {loading === "portal" ? "Opening…" : "Manage subscription"}
          </button>
        )}
      </div>

      {hasYearly && (
        <div className="mb-6 flex items-center justify-center">
          <div className="flex rounded-btn border border-borderDefault p-0.5 text-[12px]">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-[6px] px-4 py-1.5 transition ${
                billingCycle === "monthly" ? "bg-bgActive text-primary" : "text-tertiary hover:text-primary"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`flex items-center gap-1 rounded-[6px] px-4 py-1.5 transition ${
                billingCycle === "yearly" ? "bg-bgActive text-primary" : "text-tertiary hover:text-primary"
              }`}
            >
              Yearly
              <span className="rounded bg-highlight/20 px-1.5 py-0.5 text-[10px] text-highlight">
                Save 10%
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const current = workspace?.plan === plan.id;
          const price = billingCycle === "yearly" ? annualMonthlyEquivalent(plan.price) : plan.price;
          const yearlyTotal = billingCycle === "yearly" ? annualPlanPrice(plan.price) : null;
          return (
            <div key={plan.id} className={`card flex flex-col p-5 ${current ? "border-highlight/40" : ""}`}>
              <p className="text-[13px] font-semibold text-primary">{plan.name}</p>
              <p className="mt-2">
                <span className="text-2xl font-semibold text-grad-stat">${formatPrice(price)}</span>
                <span className="text-xs text-muted">/mo</span>
              </p>
              {yearlyTotal && (
                <p className="text-[10px] text-muted">
                  ${formatPrice(yearlyTotal)}/year billed annually
                </p>
              )}
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12px] text-secondary">
                    <Check size={14} className="mt-0.5 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <button
                disabled={current || !plan.priceEnv || loading === plan.id}
                onClick={() => subscribe(plan.id)}
                className={`mt-5 ${current ? "btn-secondary" : "btn-primary"} w-full`}
              >
                {current ? "Current plan" : plan.price === 0 ? "Free" : loading === plan.id ? "Redirecting…" : "Upgrade"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Billing history (Stripe subscription + invoices) */}
      {history?.subscription && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-primary">Billing history</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-[11px] uppercase tracking-wide text-tertiary">Status</p>
              <p className="mt-1 text-sm font-semibold text-primary capitalize">{history.subscription.status}</p>
              {history.subscription.cancelAtPeriodEnd && <p className="mt-0.5 text-[11px] text-amber-400">Cancels at period end</p>}
            </div>
            <div className="card p-4">
              <p className="text-[11px] uppercase tracking-wide text-tertiary">Next billing</p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {history.subscription.currentPeriodEnd
                  ? new Date(history.subscription.currentPeriodEnd).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                  : "—"}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-[11px] uppercase tracking-wide text-tertiary">Credits per renewal</p>
              <p className="mt-1 text-sm font-semibold text-primary">{history.subscription.credits.toLocaleString()}</p>
            </div>
          </div>

          {history.invoices.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-borderDefault text-[11px] uppercase tracking-wide text-tertiary">
                    <th className="px-3 py-2.5 font-medium">Invoice</th>
                    <th className="px-3 py-2.5 font-medium">Period</th>
                    <th className="px-3 py-2.5 font-medium">Amount</th>
                    <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Status</th>
                    <th className="px-3 py-2.5 font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderDefault">
                  {history.invoices.slice(0, 24).map((inv) => (
                    <tr key={inv.id} className="hover:bg-bgHover">
                      <td className="px-3 py-2.5 text-[13px] text-primary">{inv.number}</td>
                      <td className="px-3 py-2.5 text-[12px] text-muted">
                        {new Date(inv.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-primary">
                        {inv.currency.toUpperCase()} {inv.amount.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <span className={`text-[12px] capitalize ${inv.status === "paid" ? "text-emerald-400" : "text-muted"}`}>{inv.status}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {inv.hostedUrl && (
                          <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-tertiary hover:text-primary">
                            <ExternalLink size={13} /> View
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
