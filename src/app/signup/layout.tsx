import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a NotOpen account for private AI chat, multimodal generation, and API access.",
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
