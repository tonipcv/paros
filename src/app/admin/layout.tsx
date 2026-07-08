"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, Users, LayoutDashboard } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

const appName = "KRX";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loaded, load } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    if (!loaded) load().then((ok) => { if (!ok) router.replace("/login"); });
  }, [loaded, load, router]);

  if (!loaded || !user) {
    return <div className="flex h-screen items-center justify-center bg-bgPage"><div className="h-8 w-8 animate-spin rounded-full border-2 border-highlight border-t-transparent" /></div>;
  }

  // Show forbidden for non-admin
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return (
      <div className="landing-theme min-h-screen px-5 py-8">
        <div className="mx-auto max-w-[480px] pt-20 text-center">
          <Shield size={40} className="mx-auto mb-4 text-[var(--landing-faint)]" />
          <h1 className="text-xl font-semibold text-[var(--landing-text)]">Access denied</h1>
          <p className="mt-2 text-sm text-[var(--landing-faint)]">You need admin privileges to view this page.</p>
          <Link href="/chat" className="mt-6 inline-block rounded-lg bg-[var(--landing-button)] px-5 py-2.5 text-sm font-medium text-[var(--landing-button-text)]">Back to KRX</Link>
        </div>
      </div>
    );
  }

  const nav = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/users", label: "Users", icon: Users },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-bgPage">
      <aside className="hidden w-[220px] shrink-0 border-r border-borderDefault bg-sidebar sm:flex sm:flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-borderDefault px-4">
          <Shield size={18} className="text-tertiary" />
          <p className="text-[14px] font-semibold text-grad-light">{appName} Admin</p>
        </div>
        <nav className="flex-1 overflow-auto px-3 py-3 space-y-1">
          {nav.map((item) => (
            <Link key={item.to} href={item.to}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebarText hover:bg-sidebarHover hover:text-primary transition">
              <item.icon size={17} strokeWidth={2} className="text-tertiary" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto bg-bgPage">{children}</main>
    </div>
  );
}
