import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

const appName = "KRX";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://krx.ai"),
  title: {
    default: `${appName}: Private AI Infrastructure`,
    template: `%s: ${appName}`,
  },
  description:
    "KRX is a private AI workspace for chat, images, video, audio, code, and OpenAI-compatible API access with privacy-first routing.",
  applicationName: appName,
  keywords: [
    "KRX",
    "private AI",
    "privacy-first AI",
    "AI workspace",
    "OpenAI compatible API",
    "private chat",
    "AI image generation",
    "AI video generation",
  ],
  authors: [{ name: "KRX" }],
  creator: "KRX",
  publisher: "KRX",
  openGraph: {
    title: `${appName}: Private AI Infrastructure`,
    description:
      "Private multimodal AI for work that should remain yours. Chat, create, automate, and build with privacy-first routing.",
    siteName: appName,
    type: "website",
    images: [{ url: "/logo.png", width: 500, height: 500, alt: "KRX" }],
  },
  twitter: {
    card: "summary",
    title: `${appName}: Private AI Infrastructure`,
    description: "Private multimodal AI for confidential work.",
    images: ["/logo.png"],
  },
  icons: "/logo.png",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster theme="system" position="top-center" />
      </body>
    </html>
  );
}
