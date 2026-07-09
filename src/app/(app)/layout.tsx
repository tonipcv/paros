"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  Image as ImageIcon,
  KeyRound,
  CreditCard,
  Settings,
  BarChart3,
  Users,
  LogOut,
  Menu,
  MoreHorizontal,
  Shield,
  ChevronDown,
  LayoutDashboard,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { initials } from "@/lib/ui-helpers";
import { VerifyEmailBanner } from "@/components/verify-email-banner";

const appName = "KRX";

const nav = [
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/characters", label: "Characters", icon: Users },
  { to: "/studio", label: "Image Studio", icon: ImageIcon },
  { to: "/usage", label: "Usage", icon: BarChart3 },
  { to: "/keys", label: "API Keys", icon: KeyRound },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, loaded, load, logout } = useAppStore();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loaded) {
      load().then((ok) => {
        if (!ok) router.replace("/login");
      });
    } else if (!user) {
      router.replace("/login");
    }
  }, [loaded, user, load, router]);

  // Enforce email verification for non-guest, password-based accounts.
  useEffect(() => {
    if (user && !user.emailVerified && !user.email.endsWith("@guest.local") && pathname !== "/verify") {
      router.replace("/verify");
    }
  }, [user, pathname, router]);

  if (!loaded || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-bgPage">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-highlight border-t-transparent" />
      </div>
  );
}


  function isActive(to: string) {
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bgPage text-primary">
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" />
          <div className="absolute inset-y-0 left-0 w-[260px] border-r border-borderDefault bg-sidebar" onClick={(e) => e.stopPropagation()}>
            <Sidebar
              isActive={isActive}
              user={user}
              workspace={workspace}
              onClose={() => setSidebarOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      <aside className="hidden w-[272px] shrink-0 border-r border-borderDefault bg-sidebar lg:flex lg:flex-col">
        <Sidebar isActive={isActive} user={user} workspace={workspace} onLogout={handleLogout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-borderDefault px-3 lg:hidden">
          <button
            aria-label="Open navigation"
            className="grid h-8 w-8 place-items-center rounded-btn text-secondary hover:bg-bgHover hover:text-primary"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={18} />
          </button>
          <span className="text-sm font-semibold text-grad-light">{appName}</span>
          <div className="w-8" />
        </div>
        <main className="flex-1 overflow-auto bg-bgPage">
          <VerifyEmailBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
function Sidebar({
  isActive,
  user,
  workspace,
  onClose,
  onLogout,
}: {
  isActive: (to: string) => boolean;
  user: { name: string; email: string; role?: string };
  workspace: { plan: string; credits: number } | null;
  onClose?: () => void;
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);

  const adminItems = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/users", label: "Users", icon: Users },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-borderDefault px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt={appName} className="h-8 w-8 rounded-btn" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight text-grad-light">{appName}</p>
          <p className="mt-0.5 text-[11px] font-medium text-muted">Private AI workspace</p>
        </div>
      </div>

      <div className="border-b border-borderDefault px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-tertiary">Credits</span>
          <span className="text-[11px] font-medium text-silver">{workspace?.plan || "FREE"}</span>
        </div>
        <p className="mt-1 text-lg font-semibold text-grad-stat">{workspace?.credits?.toLocaleString() ?? "—"}</p>
      </div>

      <nav className="flex-1 overflow-auto px-3 py-4">
        <div className="space-y-1">
          {nav.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                href={item.to}
                onClick={onClose}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-bgActive text-primary"
                    : "text-sidebarText hover:bg-sidebarHover hover:text-primary"
                }`}
              >
                <Icon size={18} strokeWidth={2} className={active ? "text-primary" : "text-tertiary"} />
                <span>{item.label}</span>
              </Link>
              );
            })}
            {user.role !== "USER" && (
              <>
                <button
                  onClick={() => setAdminExpanded((v) => !v)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    adminExpanded ? "text-primary" : "text-sidebarText hover:bg-sidebarHover hover:text-primary"
                  }`}
                >
                  <Shield size={18} strokeWidth={2} className={adminExpanded ? "text-rose-400" : "text-tertiary"} />
                  <span className="flex-1 text-left">Admin</span>
                  <ChevronDown size={14} className={`text-muted transition-transform ${adminExpanded ? "rotate-180" : ""}`} />
                </button>
                {adminExpanded && (
                  <div className="ml-5 border-l border-borderDefault pl-3 space-y-1">
                    {adminItems.map((item) => {
                      const active = isActive(item.to);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          href={item.to}
                          onClick={onClose}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                            active ? "bg-bgActive text-primary" : "text-sidebarText hover:bg-sidebarHover hover:text-primary"
                          }`}
                        >
                          <Icon size={16} strokeWidth={2} className={active ? "text-primary" : "text-tertiary"} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
      </nav>

      <div className="relative border-t border-borderDefault p-3">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-xl border border-borderDefault bg-surface p-2 text-left transition hover:border-borderHover"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-highlight text-[12px] font-semibold text-bg">
            {initials(user.name || user.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-grad-light">{user.name || "User"}</p>
            <p className="truncate text-[11px] text-muted">{user.email}</p>
          </div>
          <MoreHorizontal size={17} className="shrink-0 text-muted" />
        </button>
        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-borderDefault bg-surface p-1 shadow-card-hover">
            <button
              onClick={onLogout}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-sidebarText transition hover:bg-bgHover hover:text-primary"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
