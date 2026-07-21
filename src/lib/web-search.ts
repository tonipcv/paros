export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export function hasWebSearch(): boolean {
  return Boolean(process.env.BRAVE_SEARCH_API_KEY);
}

export async function searchWeb(query: string, count = 5): Promise<SearchResult[]> {
  if (!hasWebSearch()) return [];
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY!,
      },
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!res.ok) {
    console.error(`Brave Search error ${res.status}`);
    return [];
  }
  const data = (await res.json().catch(() => null)) as {
    web?: { results?: { title: string; url: string; description: string }[] };
  } | null;
  const results = data?.web?.results || [];
  return results.map((r) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.description || "",
  }));
}

export function buildSearchContext(results: SearchResult[]): string {
  if (!results.length) return "";
  const blocks = results.map(
    (r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`
  );
  return `\n\n---\nThe following are recent web search results. Use them to inform your response. Cite sources using [1], [2], etc.\n\n${blocks.join("\n\n")}\n---\n`;
}
