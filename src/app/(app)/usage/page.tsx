"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Image as ImageIcon, Coins, Layers } from "lucide-react";
import { format } from "date-fns";

type Usage = {
  credits: number;
  plan: string;
  creditsUsed: number;
  chatCount: number;
  imageCount: number;
  convoCount: number;
  events: { id: string; kind: string; model: string; credits: number; createdAt: string }[];
};

export default function UsagePage() {
  const [data, setData] = useState<Usage | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const stats = [
    { label: "Credits left", value: data?.credits?.toLocaleString() ?? "—", icon: Coins },
    { label: "Credits used", value: data?.creditsUsed?.toLocaleString() ?? "—", icon: Layers },
    { label: "Chat requests", value: data?.chatCount ?? "—", icon: MessageSquare },
    { label: "Images", value: data?.imageCount ?? "—", icon: ImageIcon },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-h1 text-grad-light">Usage</h1>
        <p className="mt-1 text-sm text-muted">Track credits and activity.</p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="stat-card">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg border border-borderDefault bg-bg text-silver">
                <Icon size={17} />
              </div>
              <p className="text-2xl font-semibold text-grad-stat">{s.value}</p>
              <p className="mt-0.5 text-xs text-muted">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="card p-0">
        <div className="border-b border-borderDefault px-4 py-3">
          <p className="text-[13px] font-semibold text-primary">Recent activity</p>
        </div>
        {data?.events?.length ? (
          <div className="divide-y divide-borderDefault">
            {data.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-bgActive px-2 py-0.5 text-[10px] font-medium uppercase text-secondary">
                    {e.kind}
                  </span>
                  <span className="text-[12px] text-muted">{e.model}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[12px] text-secondary">-{e.credits} cr</span>
                  <span className="text-[11px] text-tertiary">
                    {format(new Date(e.createdAt), "MMM d, HH:mm")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted">No activity yet</p>
        )}
      </div>
    </div>
  );
}
