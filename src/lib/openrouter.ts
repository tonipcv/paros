const BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

export function hasOpenRouter() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function headers(baseUrl?: string, apiKey?: string) {
  const key = apiKey || process.env.OPENROUTER_API_KEY || "";
  const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012";
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": appUrl,
    "X-Title": "KRX",
  };
}

function _headers() {
  return headers();
}

// Privacy: route only to providers that do NOT retain/train on data.
// Applied for Private/TEE/E2EE modes; Anonymous intentionally allows any
// provider (identity is still hidden, but the provider may retain).
function privacyProvider(deny: boolean) {
  if (!deny) return {};
  if (process.env.PRIVACY_NO_RETENTION === "false") return {};
  return { provider: { data_collection: "deny" as const } };
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export type ChatOptions = { temperature?: number; top_p?: number; max_tokens?: number; dataCollectionDeny?: boolean };

/** Stream to any OpenAI-compatible endpoint (full control over baseUrl/apiKey). */
export async function streamChatTo(
  model: string,
  messages: ChatMessage[],
  baseUrl: string,
  apiKey: string,
  options: ChatOptions = {}
) {
  if (!baseUrl.endsWith("/v1")) baseUrl = `${baseUrl.replace(/\/$/, "")}/v1`;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers(baseUrl, apiKey),
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...(options.temperature != null ? { temperature: options.temperature } : {}),
      ...(options.top_p != null ? { top_p: options.top_p } : {}),
      ...(options.max_tokens != null ? { max_tokens: options.max_tokens } : {}),
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Endpoint error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.body;
}

export async function streamChat(model: string, messages: ChatMessage[], options: ChatOptions = {}) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...privacyProvider(options.dataCollectionDeny !== false),
      ...(options.temperature != null ? { temperature: options.temperature } : {}),
      ...(options.top_p != null ? { top_p: options.top_p } : {}),
      ...(options.max_tokens != null ? { max_tokens: options.max_tokens } : {}),
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.body;
}

export async function generateImage(model: string, prompt: string, inputImage?: string) {
  const content: ContentPart[] = [{ type: "text", text: prompt }];
  if (inputImage) content.push({ type: "image_url", image_url: { url: inputImage } });
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter image error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const message = data?.choices?.[0]?.message;
  const url: string | undefined = message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error("No image returned by model");
  return url;
}
