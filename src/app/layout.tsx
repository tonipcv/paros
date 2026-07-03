import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Nebula AI";

export const metadata: Metadata = {
  title: `${appName} — Private, uncensored AI`,
  description: "Chat with 200+ models and generate images. Privacy-first generative AI.",
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
