#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";

const DEFAULT_API_KEY = process.env.NOTOPEN_API_KEY || "";
const DEFAULT_BASE_URL = process.env.NOTOPEN_BASE_URL || "http://localhost:3012";

function apiKey(): string {
  if (!DEFAULT_API_KEY) throw new Error("NOTOPEN_API_KEY environment variable is required");
  return DEFAULT_API_KEY;
}

function baseUrl(): string {
  return DEFAULT_BASE_URL.replace(/\/$/, "");
}

const requestSchema = z.object({
  query: z.string().describe("The search query"),
});

const transcribeSchema = z.object({
  text: z.string().describe("Text to synthesize as speech"),
  voice: z.string().optional().describe("Voice to use (alloy, echo, fable, onyx, nova, shimmer)"),
});

async function main() {
  const server = new McpServer({
    name: "notopen",
    version: "1.0.0",
  });

  const listModels = server.registerTool(
    "list_models",
    {
      title: "List available AI models",
      description:
        "List all available AI models on the NotOpen platform, including their capabilities (reasoning, vision, uncensored) and credit costs.",
    },
    async () => {
      try {
        const res = await fetch(`${baseUrl()}/api/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey()}` },
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as any;
        const models =
          data?.data?.map((m: any) => `- ${m.id}${m.owned_by ? ` (${m.owned_by})` : ""}`).join("\n") ||
          "No models found";
        return { content: [{ type: "text" as const, text: `Available models:\n\n${models}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
      }
    }
  );

  const chat = server.registerTool(
    "chat",
    {
      title: "Send a chat message",
      description:
        "Send a message to an AI model. Specify the model ID from the list_models tool. Use for text generation, coding, analysis, and general conversation. Maximize privacy and creative freedom.",
      inputSchema: {
        model: z.string().describe("Model ID to use (see list_models)"),
        prompt: z.string().describe("Your message or question"),
        system: z.string().optional().describe("System prompt (leave empty for uncensored raw mode)"),
        temperature: z.number().optional().describe("Temperature (0-2)"),
      },
    },
    async (args) => {
      try {
        const messages = [];
        if (args.system) messages.push({ role: "system", content: args.system });
        messages.push({ role: "user", content: args.prompt });
        const res = await fetch(`${baseUrl()}/api/v1/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: args.model,
            messages,
            temperature: args.temperature,
            stream: false,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as any;
        const reply = data?.choices?.[0]?.message?.content || "No response";
        return { content: [{ type: "text" as const, text: reply }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
      }
    }
  );

  const generateImage = server.registerTool(
    "generate_image",
    {
      title: "Generate an image",
      description:
        "Generate an image from a text prompt. Use for creating visuals, illustrations, concept art, and designs. Supports multiple styles.",
      inputSchema: {
        prompt: z.string().describe("Description of the image to generate"),
        style: z.string().optional().describe("Image style (photorealistic, cinematic, anime, digital-art, 3d-render, watercolor, neon, minimal)"),
      },
    },
    async (args) => {
      try {
        const res = await fetch(`${baseUrl()}/api/v1/images/generations`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: args.prompt,
            style: args.style || "none",
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as any;
        const url = data?.data?.[0]?.url || data?.image?.url || "No image URL returned";
        return { content: [{ type: "text" as const, text: `Generated image: ${url}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
      }
    }
  );

  const synthesize = server.registerTool(
    "synthesize",
    {
      title: "Text to speech",
      description: "Convert text to spoken audio. Returns an MP3 audio file URL.",
      inputSchema: {
        text: z.string().describe("Text to convert to speech"),
        voice: z.string().optional().describe("Voice: alloy, echo, fable, onyx, nova, shimmer"),
      },
    },
    async (args) => {
      try {
        const res = await fetch(`${baseUrl()}/api/tts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: args.text.slice(0, 4000), voice: args.voice || "alloy" }),
        });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
        return {
          content: [
            {
              type: "text" as const,
              text: `Audio generated successfully (${blob.size} bytes). Format: audio/mpeg. Base64: ${base64.slice(0, 200)}...`,
            },
          ],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("MCP server failed:", e);
  process.exit(1);
});
