"use client";

import { useState } from "react";
import { Check } from "lucide-react";

type BillingCycle = "monthly" | "yearly";

const plans = [
  {
    id: "STARTER",
    name: "Pro",
    monthly: "$18",
    yearly: "$194.40",
    desc: "Your private AI studio - every model, every medium, no limits.",
    cta: "Get Pro",
    features: [
      "All Pro and Advanced models",
      "Unlimited text prompts",
      "1,000 images per day",
      "Generate video, music, and use frontier image and text models with credits",
      "Image superpowers: upscale, remove backgrounds, create variants, and more",
      "Character creation",
      "Extended context windows for deep work and longer conversations",
      "Encrypted chat backup and restore",
      "100 credits / month for video, music, premium models, and API",
      "API access",
    ],
  },
  {
    id: "PRO",
    name: "Pro+",
    monthly: "$68",
    yearly: "$734.40",
    desc: "Everything in Pro, scaled for serious creators and users.",
    cta: "Get Pro+",
    popular: true,
    features: [
      "Everything in Pro",
      "Higher image generation limits on Venice Pro models",
      "7,500 credits / month for video, music, frontier image generation, LLMs, and API",
      "2-month credit banking",
      "Annual billing discount",
    ],
  },
  {
    id: "MAX",
    name: "Max",
    monthly: "$200",
    yearly: "$2,160",
    desc: "Everything in Plus - for the ultimate access to Venice power users.",
    cta: "Get Max",
    features: [
      "Everything in Pro+",
      "Highest image generation limits on Venice Pro models",
      "22,500 credits / month for video, music, frontier image generation, frontier LLMs, and API",
      "3-month credit banking",
      "Annual billing discount",
    ],
  },
];

export function LandingPricing() {
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
    <section id="pricing" className="bg-[var(--landing-bg)]">
      <div className="mx-auto max-w-[1180px] px-5 py-24">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="text-[13px] text-[var(--landing-faint)]">Pricing</p>
          <h2 className="font-display mt-3 text-[30px] font-medium leading-[1.06] text-[var(--landing-text)] sm:text-[40px]">
            Simple pricing. No surprises.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-[var(--landing-muted)]">
            Monthly plans match Venice pricing. Yearly billing saves 10% and credits roll forward on paid plans.
          </p>
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
              <div key={plan.id} className={`relative rounded-[28px] p-6 shadow-[var(--landing-card-shadow)] ${plan.popular ? "bg-[var(--landing-card)]" : "bg-[var(--landing-card)]"}`}>
                {plan.popular ? (
                  <span className="absolute right-5 top-5 rounded-full bg-[var(--landing-button)] px-3 py-1 text-[11px] font-medium text-[var(--landing-button-text)]">
                    Most Popular
                  </span>
                ) : null}
                <h3 className="text-[18px] font-semibold text-[var(--landing-text)]">{plan.name}</h3>
                <p className="mt-3 min-h-[48px] max-w-[280px] text-[13px] leading-6 text-[var(--landing-muted)]">{plan.desc}</p>
                <div className="mt-7 flex items-end gap-1">
                  <span className="text-[38px] font-semibold leading-none text-[var(--landing-text)]">
                    {cycle === "monthly" ? plan.monthly : plan.yearly}
                  </span>
                  <span className="pb-1.5 text-[14px] text-[var(--landing-faint)]">/{cycle === "monthly" ? "mo" : "yr"}</span>
                </div>
                {cycle === "yearly" ? <p className="mt-2 text-[12px] text-[var(--landing-faint)]">Equivalent to 12 months with a 10% annual discount.</p> : null}
                <button
                  type="button"
                  disabled={loading === key}
                  onClick={() => checkout(plan.id)}
                  className={`mt-7 flex h-10 w-full items-center justify-center rounded-lg text-[13px] font-medium transition disabled:opacity-60 ${plan.popular ? "bg-[var(--landing-button)] text-[var(--landing-button-text)] hover:opacity-90" : "bg-[var(--landing-chip)] text-[var(--landing-text)] hover:bg-white/[0.1]"}`}
                >
                  {loading === key ? "Opening checkout..." : plan.cta}
                </button>
                <ul className="mt-7 space-y-3.5">
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
