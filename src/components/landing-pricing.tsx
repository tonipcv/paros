"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { annualPlanPrice, formatCredits, formatPrice, paidPlans, type BillingCycle } from "@/lib/models";

const planMarketing: Record<string, { desc: string; cta: string; popular?: boolean; features: (credits: number) => string[] }> = {
  STARTER: {
    desc: "For everyday work.",
    cta: "Get Pro",
    features: (credits) => [
      "All chat models, unlimited text",
      `${formatCredits(credits)} credits / month`,
      "Image generation",
      "API access",
    ],
  },
  PRO: {
    desc: "For heavy use.",
    cta: "Get Pro+",
    popular: true,
    features: (credits) => [
      "Everything in Pro",
      `${formatCredits(credits)} credits / month`,
      "Priority inference and higher limits",
      "2-month credit banking",
    ],
  },
  MAX: {
    desc: "For teams and builders.",
    cta: "Get Max",
    features: (credits) => [
      "Everything in Pro+",
      `${formatCredits(credits)} credits / month`,
      "Dedicated throughput",
      "Priority support",
    ],
  },
};

export function LandingPricing() {
  const plans = useMemo(() => paidPlans().map((p) => {
    const m = planMarketing[p.id];
    return {
      id: p.id,
      name: p.name,
      monthly: p.price,
      yearly: annualPlanPrice(p.price),
      desc: m?.desc ?? "",
      cta: m?.cta ?? "Get started",
      popular: m?.popular ?? false,
      features: m?.features(p.credits) ?? p.features,
    };
  }), []);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [loading, setLoading] = useState<string | null>(null);

  async function checkout(plan: string) {
    const key = `${plan}-${cycle}`;
    setLoading(key);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingCycle: cycle }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = `/login?plan=${plan}&billingCycle=${cycle}`;
        return;
      }
      if (!res.ok) throw new Error(data.error || "Checkout unavailable");
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout unavailable";
      window.location.href = `/login?plan=${plan}&billingCycle=${cycle}&error=${encodeURIComponent(message)}`;
    } finally {
      setLoading(null);
    }
  }

  return (
    <section id="pricing" className="border-t border-[var(--landing-chip)]">
      <div className="mx-auto max-w-[1080px] px-5 py-24">
        <div className="mx-auto max-w-[640px] text-center">
          <h2 className="font-display text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
            Pricing
          </h2>
          <div className="mx-auto mt-7 inline-flex rounded-full bg-[var(--landing-card)] p-1 text-[12px] shadow-[var(--landing-card-shadow)]">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`rounded-full px-4 py-2 font-medium transition ${
                cycle === "monthly" ? "bg-[var(--landing-button)] text-[var(--landing-button-text)]" : "text-[var(--landing-faint)] hover:text-[var(--landing-text)]"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle("yearly")}
              className={`rounded-full px-4 py-2 font-medium transition ${
                cycle === "yearly" ? "bg-[var(--landing-button)] text-[var(--landing-button-text)]" : "text-[var(--landing-faint)] hover:text-[var(--landing-text)]"
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const key = `${plan.id}-${cycle}`;
            return (
              <div key={plan.id} className="relative rounded-[24px] bg-[var(--landing-card)] p-6 shadow-[var(--landing-card-shadow)]">
                {plan.popular ? (
                  <span className="absolute right-5 top-5 rounded-full bg-[var(--landing-button)] px-3 py-1 text-[11px] font-medium text-[var(--landing-button-text)]">
                    Popular
                  </span>
                ) : null}
                <h3 className="text-[16px] font-semibold text-[var(--landing-text)]">{plan.name}</h3>
                <p className="mt-1.5 text-[13px] text-[var(--landing-muted)]">{plan.desc}</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="text-[34px] font-semibold leading-none text-[var(--landing-text)]">
                    ${formatPrice(cycle === "monthly" ? plan.monthly : plan.yearly)}
                  </span>
                  <span className="pb-1 text-[13px] text-[var(--landing-faint)]">/{cycle === "monthly" ? "mo" : "yr"}</span>
                </div>
                {cycle === "yearly" ? <p className="mt-2 text-[12px] text-[var(--landing-faint)]">10% annual discount applied.</p> : null}
                <button
                  type="button"
                  disabled={loading === key}
                  onClick={() => checkout(plan.id)}
                  className={`mt-6 flex h-10 w-full items-center justify-center rounded-lg text-[13px] font-medium transition disabled:opacity-60 ${plan.popular ? "bg-[var(--landing-button)] text-[var(--landing-button-text)] hover:opacity-90" : "bg-[var(--landing-chip)] text-[var(--landing-text)] hover:bg-white/[0.1]"}`}
                >
                  {loading === key ? "Opening checkout..." : plan.cta}
                </button>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-[13px] leading-5 text-[var(--landing-muted)]">
                      <Check size={15} className="mt-0.5 shrink-0 text-[var(--landing-text)]" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
