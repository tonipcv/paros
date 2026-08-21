import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://plataform.krxlab.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/usage", "/keys", "/settings", "/billing", "/chat", "/studio", "/characters"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
