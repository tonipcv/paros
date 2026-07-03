const BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

export function hasOpenRouter() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012",
    "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "HTPS.io",
  };
}

// Privacy: route only to providers that do NOT retain/train on data (unless disabled).
function privacyProvider() {
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

export type ChatOptions = { temperature?: number; top_p?: number; max_tokens?: number };

export async function streamChat(model: string, messages: ChatMessage[], options: ChatOptions = {}) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...privacyProvider(),
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
