import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser, chargeCredits } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error } from "@/lib/http";
import { streamChat, streamChatTo, hasOpenRouter, type ChatMessage, type ContentPart } from "@/lib/openrouter";
import { findChatModel } from "@/lib/models";
import { type PrivacyMode, isTeeOrE2ee, hasTeeProvider, endpoints } from "@/lib/privacy-router";

export const runtime = "nodejs";

type DocInput = { name: string; text: string };

function buildDocContext(documents: DocInput[]): string {
  if (!documents.length) return "";
  const blocks = documents
    .map((d) => `## Attached file: ${d.name}\n${d.text}`)
    .join("\n\n---\n\n");
  return `The user attached the following document(s). Use them as context.\n\n${blocks}\n\n---\n\n`;
}

function buildUserContent(text: string, images: string[], docContext: string): string | ContentPart[] {
  const fullText = docContext ? docContext + text : text;
  if (!images.length) return fullText;
  const parts: ContentPart[] = [{ type: "text", text: fullText }];
  for (const url of images) parts.push({ type: "image_url", image_url: { url } });
  return parts;
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return error("Authentication required", 401);
  }

  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return error("Workspace not found", 404);

  const body = await request.json();
  const conversationId: string | null = body.conversationId || null;
  const content: string = String(body.content || "").trim();
  const modelId: string = body.model || process.env.DEFAULT_CHAT_MODEL || "";
  const images: string[] = Array.isArray(body.images)
    ? body.images.filter((a: unknown) => typeof a === "string").slice(0, 4)
    : Array.isArray(body.attachments)
      ? body.attachments.filter((a: unknown) => typeof a === "string").slice(0, 4)
      : [];
  const documents: DocInput[] = Array.isArray(body.documents)
    ? body.documents
        .filter((d: any) => d && typeof d.name === "string" && typeof d.text === "string")
        .slice(0, 6)
    : [];
  const storedAttachments = [
    ...images.map((url) => ({ kind: "image", url })),
    ...documents.map((d) => ({ kind: "file", name: d.name })),
  ];
  const ephemeral = Boolean(body.ephemeral);
  const encrypted = Boolean(body.encrypted);
  const skipStore = ephemeral || encrypted;
  const privacyMode: PrivacyMode = ["anonymous", "private", "tee", "e2ee"].includes(body.privacyMode)
    ? body.privacyMode
    : "private";
  if (!content && !images.length && !documents.length) return error("content or attachment required");

  const model = findChatModel(modelId);
  if (ws.credits < model.credits) return error("Insufficient credits", 402);

  let priorMessages: { role: string; content: string | ContentPart[] }[] = [];
  let systemPrompt: string | null = null;
  let temperature = 0.7;

  if (skipStore) {
    // Zero-retention (ephemeral) or E2E-encrypted: server never stores plaintext.
    // History and system prompt are supplied by the client (held in memory / decrypted client-side).
    const clientHistory = Array.isArray(body.history) ? body.history : [];
    priorMessages = clientHistory
      .filter((m: any) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m: any) => ({ role: m.role, content: m.content }));
    systemPrompt = typeof body.systemPrompt === "string" && body.systemPrompt.trim() ? body.systemPrompt : null;
    if (typeof body.temperature === "number") temperature = body.temperature;
  } else {
    if (!conversationId) return error("conversationId required");
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, workspaceId: ws.id },
      include: { messages: { orderBy: { createdAt: "asc" } }, character: true },
    });
    if (!conversation) return error("Conversation not found", 404);

    systemPrompt = conversation.character?.systemPrompt || conversation.systemPrompt || null;
    temperature = conversation.temperature ?? 0.7;
    priorMessages = conversation.messages.map((m) => ({ role: m.role, content: m.content }));

    await prisma.message.create({
      data: { conversationId, role: "user", content, attachments: storedAttachments },
    });

    const firstUserMessage = conversation.messages.filter((m) => m.role === "user").length === 0;
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { model: model.id, ...(firstUserMessage ? { title: content.slice(0, 60) || "New chat" } : {}) },
    });
  }

  const docContext = buildDocContext(documents);
  const history: ChatMessage[] = [
    ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
    ...priorMessages.map((m) => ({ role: m.role as ChatMessage["role"], content: m.content })),
    { role: "user", content: buildUserContent(content, images, docContext) },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        if (!hasOpenRouter()) {
          const demo = `OPENROUTER_API_KEY não configurada. Adicione sua chave em .env para respostas reais.\n\nVocê perguntou: "${content}"`;
          for (const chunk of demo.match(/.{1,4}/g) || [demo]) {
            full += chunk;
            controller.enqueue(encoder.encode(chunk));
            await new Promise((r) => setTimeout(r, 12));
          }
        } else {
          let respBody: ReadableStream;
          if (isTeeOrE2ee(privacyMode) && hasTeeProvider()) {
            const ep = endpoints()[privacyMode];
            if (!ep) throw new Error("TEE provider not configured");
            // Map to model IDs the TEE provider understands (strip duplicate prefixes)
            const teeModel = model.id.replace(/^(openrouter|teeprovider)\//, "");
            respBody = await streamChatTo(teeModel, history, ep.baseUrl, ep.apiKey, { temperature });
          } else {
            respBody = await streamChat(model.id, history, { temperature });
          }
          const reader = respBody.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  full += delta;
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {
                // ignore partial json
              }
            }
          }
        }
      } catch (e: any) {
        const msg = `\n\n[error] ${e.message || "stream failed"}`;
        full += msg;
        controller.enqueue(encoder.encode(msg));
      } finally {
        if (!skipStore && conversationId) {
          await prisma.message
            .create({ data: { conversationId, role: "assistant", content: full, model: model.id } })
            .catch(() => {});
        }
        await chargeCredits(ws.id, "chat", model.id, model.credits).catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
