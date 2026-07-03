"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { PLANS } from "@/lib/models";

export default function BillingPage() {
  const { workspace, load } = useAppStore();
  const [loading, setLoading] = useState<string | null>(null);

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
    } catch (e: any) {
      toast.error(e.message);
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
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message);
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const current = workspace?.plan === plan.id;
          return (
            <div key={plan.id} className={`card flex flex-col p-5 ${current ? "border-highlight/40" : ""}`}>
              <p className="text-[13px] font-semibold text-primary">{plan.name}</p>
              <p className="mt-2">
                <span className="text-2xl font-semibold text-grad-stat">${plan.price}</span>
                <span className="text-xs text-muted">/mo</span>
              </p>
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
    </div>
  );
}
