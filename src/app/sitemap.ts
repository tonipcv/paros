import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://plataform.krxlab.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const news = [
    "bleeding-llama-ollama-critical-memory-leak",
    "chatgpt-data-leakage-check-point",
    "cometjacking-perplexity-ai-browser",
    "google-dialogflow-chatbot-flaw-monitor-conversations",
    "judge-allows-us-search-warrant-ai-chatbot-records",
    "spacexai-grok-build-upload-codebase",
    "us-court-rules-against-krafton-ai-hatched-takeover",
  ];

  const staticRoutes = [
    { path: "", priority: 1, changefreq: "weekly" as const },
    { path: "/pricing", priority: 0.9, changefreq: "monthly" as const },
    { path: "/how-it-works", priority: 0.8, changefreq: "monthly" as const },
    { path: "/docs", priority: 0.7, changefreq: "monthly" as const },
    { path: "/news", priority: 0.7, changefreq: "daily" as const },
    { path: "/privacy", priority: 0.3, changefreq: "yearly" as const },
    { path: "/terms", priority: 0.3, changefreq: "yearly" as const },
    { path: "/signup", priority: 0.6, changefreq: "monthly" as const },
    { path: "/login", priority: 0.4, changefreq: "monthly" as const },
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: `${baseUrl}${route.path}`,
      lastModified: now,
      changeFrequency: route.changefreq,
      priority: route.priority,
    })),
    ...news.map((slug) => ({
      url: `${baseUrl}/news/${slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
