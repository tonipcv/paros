import { requireBillingReconciliation, settleBillingReservation } from "./billing-engine";
import { usdToMicros } from "./unit-economics";

type ProviderUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  cost?: number;
};

function settlement(id: string, provider: string, providerRequestId: string | undefined, usage: ProviderUsage | undefined) {
  if (!usage || typeof usage.cost !== "number") {
    return requireBillingReconciliation(id, providerRequestId);
  }
  const providerCostMicros = usdToMicros(usage.cost);
  const providerFeeMicros = provider === "openrouter" ? (providerCostMicros * 55n + 999n) / 1000n : 0n;
  return settleBillingReservation(id, {
    providerRequestId,
    providerCostMicros,
    providerFeeMicros,
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    cachedTokens: usage.prompt_tokens_details?.cached_tokens,
  });
}

export async function meterOpenAIResponse(response: Response, ledgerId: string, provider: string, streaming: boolean) {
  if (!streaming) {
    const raw = await response.text();
    try {
      const payload = JSON.parse(raw) as { id?: string; usage?: ProviderUsage };
      await settlement(ledgerId, provider, payload.id, payload.usage);
    } catch {
      await requireBillingReconciliation(ledgerId).catch(() => undefined);
    }
    return new Response(raw, { status: response.status, headers: response.headers });
  }

  if (!response.body) {
    await requireBillingReconciliation(ledgerId).catch(() => undefined);
    return response;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let usage: ProviderUsage | undefined;
  let providerRequestId: string | undefined;
  const inspect = (text: string, final = false) => {
    buffer += text;
    const lines = buffer.split("\n");
    buffer = final ? "" : lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const payload = JSON.parse(data) as { id?: string; usage?: ProviderUsage };
        if (payload.id) providerRequestId = payload.id;
        if (payload.usage) usage = payload.usage;
      } catch { /* partial or provider-specific event */ }
    }
  };

  const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      inspect(decoder.decode(chunk, { stream: true }));
      controller.enqueue(chunk);
    },
    async flush() {
      inspect(decoder.decode(), true);
      await settlement(ledgerId, provider, providerRequestId, usage).catch(() => undefined);
    },
  }));
  return new Response(body, { status: response.status, headers: response.headers });
}
