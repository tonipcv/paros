import type { Metadata } from "next";
import { Toaster } from "sonner";
import { CookieConsent } from "@/components/cookie-consent";
import "./globals.css";

const appName = "NotOpen";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://plataform.krxlab.com"),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  title: {
    default: `${appName}: Private AI Infrastructure`,
    template: `%s: ${appName}`,
  },
  description:
    "NotOpen is a private AI workspace for chat, images, video, audio, code, and OpenAI-compatible API access with privacy-first routing.",
  applicationName: appName,
  keywords: [
    "NotOpen",
    "private AI",
    "privacy-first AI",
    "AI workspace",
    "OpenAI compatible API",
    "private chat",
    "AI image generation",
    "AI video generation",
  ],
  authors: [{ name: "NotOpen" }],
  creator: "NotOpen",
  publisher: "NotOpen",
  openGraph: {
    title: `${appName}: Private AI Infrastructure`,
    description:
      "Private multimodal AI for work that should remain yours. Chat, create, automate, and build with privacy-first routing.",
    siteName: appName,
    type: "website",
    images: [{ url: "/logo.png", width: 500, height: 500, alt: "NotOpen" }],
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
        <CookieConsent />
      </body>
    </html>
  );
}
