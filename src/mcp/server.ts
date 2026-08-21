#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";
import { pathToFileURL } from "node:url";

const REQUEST_TIMEOUT_MS = 60_000;

const apiErrorSchema = z.object({ error: z.union([z.string(), z.object({ message: z.string() }).passthrough()]).optional() }).passthrough();
const modelsSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    owned_by: z.string().optional(),
    name: z.string().optional(),
    context_window: z.union([z.string(), z.number()]).optional(),
    capabilities: z.object({ vision: z.boolean().optional(), reasoning: z.boolean().optional(), uncensored: z.boolean().optional() }).optional(),
    credits_per_request: z.number().optional(),
  }).passthrough()),
});
const chatSchema = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })) });
const imageSchema = z.object({ data: z.array(z.object({ url: z.string().url() })).min(1) });

function validateConfig(apiKey: string, baseUrl: string) {
  if (!apiKey) throw new Error("KRX_API_KEY environment variable is required");
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("KRX_BASE_URL must be an HTTP(S) URL");
}

function createApi(apiKey: string, baseUrl: string) {
  return async (path: string, init: RequestInit = {}): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, ...init.headers },
      signal: controller.signal,
    });
    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      let message = raw || `HTTP ${response.status}`;
      try {
        const parsed = apiErrorSchema.parse(JSON.parse(raw));
        if (typeof parsed.error === "string") message = parsed.error;
        else if (parsed.error?.message) message = parsed.error.message;
      } catch { /* preserve the safe raw response */ }
      throw new Error(`${response.status}: ${message.slice(0, 500)}`);
    }
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("The KRX API request timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }
  };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return { isError: true, content: [{ type: "text" as const, text: `KRX API error: ${message}` }] };
}

export function createKRXMcpServer(options: { apiKey: string; baseUrl: string }) {
  const apiKey = options.apiKey.trim();
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  validateConfig(apiKey, baseUrl);
  const api = createApi(apiKey, baseUrl);
  const server = new McpServer({ name: "krx", version: "1.1.0" });

  server.registerTool(
    "list_models",
    {
      title: "List available AI models",
      description: "List KRX chat models with capabilities and credit cost.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const data = modelsSchema.parse(await (await api("/api/v1/models")).json());
        const rows = data.data.map((model) => {
          const capabilities = Object.entries(model.capabilities || {}).filter(([, enabled]) => enabled).map(([name]) => name).join(", ");
          const details = [model.owned_by, capabilities, model.context_window ? `context ${model.context_window}` : "", model.credits_per_request != null ? `${model.credits_per_request} credits/request` : ""].filter(Boolean).join("; ");
          return `- ${model.id}${model.name ? ` — ${model.name}` : ""}${details ? ` (${details})` : ""}`;
        });
        return { content: [{ type: "text" as const, text: `Available models:\n\n${rows.join("\n") || "No models found"}` }] };
      } catch (error) { return toolError(error); }
    }
  );

  server.registerTool(
    "chat",
    {
      title: "Send a chat message",
      description: "Generate a response using a KRX model. This operation consumes credits.",
      inputSchema: {
        model: z.string().min(1).describe("Exact model ID returned by list_models"),
        prompt: z.string().min(1).max(200_000).describe("User message"),
        system: z.string().max(50_000).optional().describe("Optional system instruction"),
        temperature: z.number().min(0).max(2).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      try {
        const messages: Array<{ role: "system" | "user"; content: string }> = [];
        if (args.system) messages.push({ role: "system", content: args.system });
        messages.push({ role: "user", content: args.prompt });
        const response = await api("/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: args.model, messages, temperature: args.temperature, stream: false }),
        });
        const data = chatSchema.parse(await response.json());
        return { content: [{ type: "text" as const, text: data.choices[0]?.message.content || "The model returned an empty response." }] };
      } catch (error) { return toolError(error); }
    }
  );

  server.registerTool(
    "generate_image",
    {
      title: "Generate an image",
      description: "Generate an image and return its hosted URL. This operation consumes credits.",
      inputSchema: { prompt: z.string().min(1).max(8000), model: z.string().optional().describe("Optional image model ID") },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      try {
        const response = await api("/api/v1/images/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: args.prompt, ...(args.model ? { model: args.model } : {}) }),
        });
        const data = imageSchema.parse(await response.json());
        return { content: [{ type: "text" as const, text: `Generated image: ${data.data[0].url}` }] };
      } catch (error) { return toolError(error); }
    }
  );

  server.registerTool(
    "synthesize",
    {
      title: "Text to speech",
      description: "Convert text to MP3 audio. This operation consumes credits.",
      inputSchema: { text: z.string().min(1).max(4000), voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      try {
        const response = await api("/api/v1/audio/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: args.text, voice: args.voice || "alloy" }),
        });
        const data = Buffer.from(await response.arrayBuffer()).toString("base64");
        return { content: [{ type: "audio" as const, data, mimeType: "audio/mpeg" }] };
      } catch (error) { return toolError(error); }
    }
  );

  return server;
}

async function main() {
  const server = createKRXMcpServer({
    apiKey: process.env.KRX_API_KEY || "",
    baseUrl: process.env.KRX_BASE_URL || "http://localhost:3012",
  });
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`MCP server failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
