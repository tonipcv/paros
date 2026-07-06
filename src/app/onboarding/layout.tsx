import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace setup",
  description: "Set up your KRX private AI workspace.",
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
