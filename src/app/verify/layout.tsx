import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify email",
  description: "Verify your NotOpen email address.",
  robots: { index: false, follow: false },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
