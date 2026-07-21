const BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS) || 8192;
const MAX_INPUT_TOKENS = Number(process.env.MAX_INPUT_TOKENS) || 128_000;

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
    "X-Title": "NotOpen",
  };
}

function anonymousHeaders(baseUrl?: string, apiKey?: string) {
  const key = apiKey || process.env.OPENROUTER_API_KEY || "";
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function withTimeout(signal?: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  if (signal) {
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      ctrl.abort(signal.reason);
    });
  }
  return ctrl.signal;
}

// Private mode: enforce Zero Data Retention (ZDR) — only route to providers
// with contractual zero-retention. Combined with data_collection: deny for
// defense-in-depth. Fallback is blocked to prevent silent privacy downgrades.
function zdrProvider() {
  if (process.env.PRIVACY_NO_RETENTION === "false") return {};
  return {
    provider: {
      zdr: true as const,
      data_collection: "deny" as const,
    },
  };
}

// Anonymous mode: only deny data_collection; allow any provider.
function anonymousProvider() {
  return {};
}

function privacyBody(mode: "anonymous" | "private") {
  if (mode === "private") return zdrProvider();
  return anonymousProvider();
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export type ChatOptions = {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  anonymized?: boolean;
  reasoningEffort?: string;
};

export type ChatResult = {
  body: ReadableStream<Uint8Array>;
  usage?: UsageInfo;
};

export type UsageInfo = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
};

/** Parse OpenRouter usage from the final SSE chunk ([DONE] or last data frame). */
function parseUsageFromSSE(chunkData: string): UsageInfo | undefined {
  try {
    const parsed = JSON.parse(chunkData);
    const usage = parsed?.usage;
    if (!usage) return undefined;
    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      cost: usage.cost,
    };
  } catch {
    return undefined;
  }
}

/** Stream to any OpenAI-compatible endpoint (full control over baseUrl/apiKey). */
export async function streamChatTo(
  model: string,
  messages: ChatMessage[],
  baseUrl: string,
  apiKey: string,
  options: ChatOptions = {}
): Promise<ChatResult> {
  if (!baseUrl.endsWith("/v1")) baseUrl = `${baseUrl.replace(/\/$/, "")}/v1`;
  const hdrs = options.anonymized ? anonymousHeaders(baseUrl, apiKey) : headers(baseUrl, apiKey);
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: options.max_tokens ?? MAX_OUTPUT_TOKENS,
      ...(options.temperature != null ? { temperature: options.temperature } : {}),
      ...(options.top_p != null ? { top_p: options.top_p } : {}),
      ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
    }),
    signal: withTimeout(),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Endpoint error ${res.status}: ${text.slice(0, 300)}`);
  }
  return { body: res.body };
}

export async function streamChat(
  model: string,
  messages: ChatMessage[],
  privacyMode: "anonymous" | "private",
  options: ChatOptions = {}
): Promise<ChatResult> {
  const hdrs = options.anonymized ? anonymousHeaders() : headers();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: options.max_tokens ?? MAX_OUTPUT_TOKENS,
      ...privacyBody(privacyMode),
      ...(options.temperature != null ? { temperature: options.temperature } : {}),
      ...(options.top_p != null ? { top_p: options.top_p } : {}),
      ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
    }),
    signal: withTimeout(),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 300)}`);
  }
  return { body: res.body };
}

// Fallback only for 404 (model offline). Does NOT change privacy tier.
// Private mode stays ZDR-enforced with zdr:true — no silent downgrade.
export async function streamChatWithFallback(
  model: string,
  fallbackModel: string,
  messages: ChatMessage[],
  privacyMode: "anonymous" | "private",
  options: ChatOptions = {}
): Promise<ChatResult> {
  try {
    return await streamChat(model, messages, privacyMode, options);
  } catch (e: any) {
    if (e.message?.includes("error 404") && model !== fallbackModel) {
      return streamChat(fallbackModel, messages, privacyMode, options);
    }
    throw e;
  }
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
