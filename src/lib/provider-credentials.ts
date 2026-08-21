let cachedRaw: string | undefined;
let cachedKeys: Record<string, string> = {};

function configuredKeys() {
  const raw = process.env.MODEL_PROVIDER_KEYS_JSON || "";
  if (raw === cachedRaw) return cachedKeys;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw || "{}") as Record<string, unknown>;
    cachedKeys = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1])));
  } catch {
    cachedKeys = {};
  }
  return cachedKeys;
}

export function providerApiKey(slug: string): string | undefined {
  if (slug === "openrouter") return process.env.OPENROUTER_API_KEY;
  if (slug === "fal") return process.env.FAL_KEY;
  if (slug === "openai") return process.env.OPENAI_API_KEY;
  return configuredKeys()[slug];
}
