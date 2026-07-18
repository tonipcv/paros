"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Image as ImageIcon, Coins, Layers } from "lucide-react";
import { format } from "date-fns";
import { PageContainer, PageHeader, StatCard } from "@/components/ui";

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
    { label: "Credits left", value: data?.credits?.toLocaleString() ?? "0", icon: Coins },
    { label: "Credits used", value: data?.creditsUsed?.toLocaleString() ?? "0", icon: Layers },
    { label: "Chat requests", value: data?.chatCount ?? "0", icon: MessageSquare },
    { label: "Images", value: data?.imageCount ?? "0", icon: ImageIcon },
  ];

  return (
    <PageContainer width="default">
      <PageHeader title="Usage" description="Track credits and activity." />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          return <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} />;
        })}
      </div>

      <div className="mt-8">
        <h2 className="text-h3 text-primary mb-4">Recent activity</h2>
        {data?.events?.length ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-t border-borderDefault text-caption text-muted uppercase tracking-wide">
                <th className="py-3 pr-4 font-medium">Event</th>
                <th className="py-3 pr-4 font-medium text-right">Credits</th>
                <th className="py-3 font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e) => (
                <tr key={e.id} className="border-t border-borderDefault">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-bgActive px-2 py-0.5 text-[10px] font-medium uppercase text-secondary">
                        {e.kind}
                      </span>
                      <span className="text-[12px] text-muted">{e.model}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span className="text-[12px] text-secondary">-{e.credits} cr</span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="text-[11px] text-tertiary">
                      {format(new Date(e.createdAt), "MMM d, HH:mm")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="border-t border-borderDefault py-10 text-center text-caption text-tertiary">No activity yet</p>
        )}
      </div>
    </PageContainer>
  );
}
