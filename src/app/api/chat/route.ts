import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser, reserveCredits, refundCredits, acquireConcurrencySlot, releaseConcurrencySlot, reserveDailySpend, settleDailySpend, releaseDailySpend, getDailyChatCount, estimateTokens, createUsageEvent, recordUsageSettled, releaseUsageReservation, createInferenceAttempt, markAttemptSent, settleAttempt, markAttemptReconciliationRequired, markAttemptFailed } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error } from "@/lib/http";
import { streamChat, streamChatTo, hasOpenRouter, type ChatMessage, type ContentPart } from "@/lib/openrouter";
import { findChatModel, CHAT_MODELS, getPlanLimits, type ChatModel } from "@/lib/models";
import { type PrivacyMode, isTeeOrE2ee, hasTeeProvider, endpoints } from "@/lib/privacy-router";
import { verifyTeeAttestation } from "@/lib/attestation";
import { searchWeb, buildSearchContext } from "@/lib/web-search";
import { detectPromptInjection } from "@/lib/prompt-injection";
import { rateLimitShared } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 90;

const CHAT_RATE_LIMIT = 30;
const CHAT_RATE_WINDOW = 60;
const ESTIMATED_MAX_COST_USD = 0.05;

type DocInput = { name: string; text: string };

function buildDocContext(documents: DocInput[]): string {
  if (!documents.length) return "";
  return `The user attached the following document(s). Use them as context.\n\n${documents.map((d) => `## Attached file: ${d.name}\n${d.text}`).join("\n\n---\n\n")}\n\n---\n\n`;
}

function buildUserContent(text: string, images: string[], docContext: string): string | ContentPart[] {
  const fullText = docContext ? docContext + text : text;
  if (!images.length) return fullText;
  return [{ type: "text", text: fullText }, ...images.map((url) => ({ type: "image_url" as const, image_url: { url } }))];
}

function contextTokens(m: ChatModel): number {
  const c = parseInt(m.context) || 0;
  return c > 0 ? c * 1024 : 128_000;
}

export async function POST(request: Request) {
  let user; try { user = await requireUser(); } catch { return error("Authentication required", 401); }
  const ws = await getWorkspaceForUser(user.id);
  if (!ws) return error("Workspace not found", 404);

  const limits = getPlanLimits(ws.plan);
  const estMicros = BigInt(Math.ceil(ESTIMATED_MAX_COST_USD * 1_000_000));
  const limitMicros = BigInt(Math.ceil(limits.dailySpendLimitUsd * 1_000_000));
  const fallbackModel = findChatModel(CHAT_MODELS[0]?.id || "");

  // 1. Rate limit
  if (!(await rateLimitShared(`chat:user:${ws.id}`, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW)).ok) return error("Rate limit exceeded.", 429);
  // 2. Daily request cap
  if ((await getDailyChatCount(ws.id)) >= limits.maxChatsPerDay) return error("Daily chat limit reached.", 429);
  // 3. Concurrency lease
  const lease = await acquireConcurrencySlot(ws.id, limits.maxConcurrency);
  if (!lease) return error("Too many concurrent requests.", 429);
  // 4. Daily spend reservation
  if (!(await reserveDailySpend(ws.id, estMicros, limitMicros))) { releaseConcurrencySlot(ws.id, lease.slot, lease.requestId).catch(() => {}); return error("Daily spending limit reached.", 402); }

  const body = await request.json();
  const conversationId: string | null = body.conversationId || null;
  const content: string = String(body.content || "").trim();
  const modelId: string = body.model || process.env.DEFAULT_CHAT_MODEL || "";
  const images: string[] = Array.isArray(body.images) ? body.images.filter((a: unknown) => typeof a === "string").slice(0, 4) : Array.isArray(body.attachments) ? body.attachments.filter((a: unknown) => typeof a === "string").slice(0, 4) : [];
  const documents: DocInput[] = Array.isArray(body.documents) ? body.documents.filter((d: any) => d && typeof d.name === "string" && typeof d.text === "string").slice(0, 6) : [];
  const storedAttachments = [...images.map((url) => ({ kind: "image", url })), ...documents.map((d) => ({ kind: "file", name: d.name }))];
  const ephemeral = Boolean(body.ephemeral), encrypted = Boolean(body.encrypted), skipStore = ephemeral || encrypted;
  const webSearch = Boolean(body.webSearch) && content.trim().length > 0;
  const rawMode = Boolean(body.rawMode);
  const privacyMode: PrivacyMode = ["anonymous", "private", "tee", "e2ee"].includes(body.privacyMode) ? body.privacyMode : "private";
  if (!content && !images.length && !documents.length) { releaseDailySpend(ws.id, estMicros).catch(() => {}); releaseConcurrencySlot(ws.id, lease.slot, lease.requestId).catch(() => {}); return error("content or attachment required"); }

  const model = findChatModel(modelId);
  const docChars = documents.reduce((sum, d) => sum + d.text.length, 0);
  const totalInputChars = content.length + docChars;
  if (totalInputChars > limits.maxInputChars) { releaseDailySpend(ws.id, estMicros).catch(() => {}); releaseConcurrencySlot(ws.id, lease.slot, lease.requestId).catch(() => {}); return error(`Input too large. Maximum ${limits.maxInputChars.toLocaleString()} characters.`, 413); }

  // 5. Token budget: validate against min(model context, fallback context)
  const estimatedInput = estimateTokens(content + buildDocContext(documents));
  const effectiveCtx = isTeeOrE2ee(privacyMode) ? contextTokens(model) : Math.min(contextTokens(model), contextTokens(fallbackModel));
  if (estimatedInput + limits.maxOutputTokens > effectiveCtx) { releaseDailySpend(ws.id, estMicros).catch(() => {}); releaseConcurrencySlot(ws.id, lease.slot, lease.requestId).catch(() => {}); return error(`Token budget (${(estimatedInput + limits.maxOutputTokens).toLocaleString()}) exceeds effective context (${effectiveCtx.toLocaleString()}).`, 413); }

  if (ws.credits < model.credits) { releaseDailySpend(ws.id, estMicros).catch(() => {}); releaseConcurrencySlot(ws.id, lease.slot, lease.requestId).catch(() => {}); return error("Insufficient credits", 402); }

  if (isTeeOrE2ee(privacyMode)) {
    if (!hasTeeProvider()) { releaseDailySpend(ws.id, estMicros).catch(() => {}); releaseConcurrencySlot(ws.id, lease.slot, lease.requestId).catch(() => {}); return error("TEE unavailable.", 503); }
    const att = await verifyTeeAttestation(privacyMode);
    if (!att.verified) { releaseDailySpend(ws.id, estMicros).catch(() => {}); releaseConcurrencySlot(ws.id, lease.slot, lease.requestId).catch(() => {}); return error(`TEE attestation not verified (${att.reason || "unverified"}).`, 502); }
  }

  if (!(await reserveCredits(ws.id, model.credits))) { releaseDailySpend(ws.id, estMicros).catch(() => {}); releaseConcurrencySlot(ws.id, lease.slot, lease.requestId).catch(() => {}); return error("Insufficient credits", 402); }
  let creditsHeld = model.credits;

  let usageEventId: string;
  try { usageEventId = await createUsageEvent(ws.id, "chat", model.id, model.credits); } catch { refundCredits(ws.id, creditsHeld).catch(() => {}); creditsHeld = 0; releaseDailySpend(ws.id, estMicros).catch(() => {}); releaseConcurrencySlot(ws.id, lease.slot, lease.requestId).catch(() => {}); return error("Failed to record usage", 500); }

  const cleanup = () => { releaseConcurrencySlot(ws.id, lease.slot, lease.requestId).catch(() => {}); };

  let priorMessages: { role: string; content: string | ContentPart[] }[] = [];
  let systemPrompt: string | null = null;
  let temperature = 0.7;

  try {
    if (skipStore) {
      const clientHistory = Array.isArray(body.history) ? body.history : [];
      priorMessages = clientHistory.filter((m: any) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").map((m: any) => ({ role: m.role, content: m.content }));
      systemPrompt = typeof body.systemPrompt === "string" && body.systemPrompt.trim() ? body.systemPrompt : null;
      if (typeof body.temperature === "number") temperature = body.temperature;
    } else {
      if (!conversationId) { releaseUsageReservation(usageEventId).catch(() => {}); refundCredits(ws.id, creditsHeld).catch(() => {}); releaseDailySpend(ws.id, estMicros).catch(() => {}); cleanup(); return error("conversationId required"); }
      const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, workspaceId: ws.id }, include: { messages: { orderBy: { createdAt: "asc" } }, character: true } });
      if (!conversation) { releaseUsageReservation(usageEventId).catch(() => {}); refundCredits(ws.id, creditsHeld).catch(() => {}); releaseDailySpend(ws.id, estMicros).catch(() => {}); cleanup(); return error("Conversation not found", 404); }
      systemPrompt = conversation.character?.systemPrompt || conversation.systemPrompt || null;
      temperature = conversation.temperature ?? 0.7;
      priorMessages = conversation.messages.map((m) => ({ role: m.role, content: m.content }));
      await prisma.message.create({ data: { conversationId, role: "user", content, attachments: storedAttachments } });
      const firstUser = conversation.messages.filter((m) => m.role === "user").length === 0;
      await prisma.conversation.update({ where: { id: conversationId }, data: { model: model.id, ...(firstUser ? { title: content.slice(0, 60) || "New chat" } : {}) } });
    }
  } catch (e: any) { releaseUsageReservation(usageEventId).catch(() => {}); refundCredits(ws.id, creditsHeld).catch(() => {}); releaseDailySpend(ws.id, estMicros).catch(() => {}); cleanup(); return error(e.message || "Preparation failed", 500); }

  const docContext = buildDocContext(documents);
  let searchContext = "";
  if (webSearch) { const results = await searchWeb(content); if (results.length) searchContext = buildSearchContext(results); }

  if (!model.uncensored) {
    for (const input of [...priorMessages.map((m) => m.content), content, ...documents.map((d) => d.text)].filter(Boolean)) {
      if (detectPromptInjection(String(input)).detected) { releaseUsageReservation(usageEventId).catch(() => {}); refundCredits(ws.id, creditsHeld).catch(() => {}); releaseDailySpend(ws.id, estMicros).catch(() => {}); cleanup(); return error("Content blocked", 400); }
    }
  }

  const effectiveSystemPrompt = rawMode ? (searchContext ? `Use the following web search results to inform your response.\n${searchContext}` : null) : systemPrompt ? (searchContext ? `${systemPrompt}\n\nUse the following web search results to inform your response.\n${searchContext}` : systemPrompt) : (searchContext ? `Use the following web search results to inform your response.\n${searchContext}` : null);

  const history: ChatMessage[] = [...(effectiveSystemPrompt ? [{ role: "system" as const, content: effectiveSystemPrompt }] : []), ...priorMessages.map((m) => ({ role: m.role as ChatMessage["role"], content: m.content })), { role: "user", content: buildUserContent(content, images, docContext) }];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      let fetchWasInitiated = false; // set true as soon as fetch() is called — any failure after this is ambiguous
      let generationId: string | null = null;
      let usageInfo: { tokens?: number; cost?: number } = {};
      let finalAttemptId: string | null = null;
      let streamCompleted = false;

      try {
        if (!hasOpenRouter()) {
          const demo = `OPENROUTER_API_KEY not configured.\n\nYou asked: "${content}"`;
          for (const chunk of demo.match(/.{1,4}/g) || [demo]) { full += chunk; controller.enqueue(encoder.encode(chunk)); await new Promise((r) => setTimeout(r, 12)); }
          streamCompleted = true;
        } else if (isTeeOrE2ee(privacyMode)) {
          const ep = endpoints()[privacyMode]; if (!ep) throw new Error("TEE provider not configured");
          const teeModel = model.id.replace(/^(openrouter|teeprovider)\//, "");
          const attId = await createInferenceAttempt(usageEventId, 1, "phala", teeModel);
          finalAttemptId = attId;
          await markAttemptSent(attId);
          fetchWasInitiated = true;
          const result = await streamChatTo(teeModel, history, ep.baseUrl, ep.apiKey, { temperature, max_tokens: limits.maxOutputTokens });
          const reader = result.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
          while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || ""; for (const line of lines) { const trimmed = line.trim(); if (!trimmed.startsWith("data:")) continue; const data = trimmed.slice(5).trim(); if (data === "[DONE]") continue; try { const p = JSON.parse(data); if (p.choices?.[0]?.delta?.content) { full += p.choices[0].delta.content; controller.enqueue(encoder.encode(p.choices[0].delta.content)); } if (p.usage) usageInfo = { tokens: p.usage.total_tokens, cost: p.usage.cost }; if (p.id) generationId = p.id; } catch {} } }
          await settleAttempt(attId, generationId, usageInfo.cost ? BigInt(Math.round(usageInfo.cost * 1_000_000)) : 0n, usageInfo.tokens ?? 0);
          streamCompleted = true;
        } else {
          const orMode = privacyMode === "anonymous" ? "anonymous" : "private";
          // Attempt 1: primary model
          let attemptNumber = 1;
          const attId1 = await createInferenceAttempt(usageEventId, attemptNumber, "openrouter", model.id);
          finalAttemptId = attId1;
          await markAttemptSent(attId1);
          fetchWasInitiated = true;
          let respBody: ReadableStream;
          try {
            const r = await streamChat(model.id, history, orMode, { temperature, max_tokens: limits.maxOutputTokens, anonymized: privacyMode === "anonymous" });
            respBody = r.body;
          } catch (e: any) {
            if (e.message?.includes("error 404") && model.id !== fallbackModel.id) {
              // Model offline — fallback (only for 404, same privacy tier)
              await markAttemptFailed(attId1, e.message);
              attemptNumber++;
              const attId2 = await createInferenceAttempt(usageEventId, attemptNumber, "openrouter", fallbackModel.id);
              finalAttemptId = attId2;
              await markAttemptSent(attId2);
              const r = await streamChat(fallbackModel.id, history, orMode, { temperature, max_tokens: limits.maxOutputTokens, anonymized: privacyMode === "anonymous" });
              respBody = r.body;
            } else {
              throw e;
            }
          }
          // Stream response
          const reader = respBody.getReader(); const decoder = new TextDecoder(); let buffer = "";
          while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || ""; for (const line of lines) { const trimmed = line.trim(); if (!trimmed.startsWith("data:")) continue; const data = trimmed.slice(5).trim(); if (data === "[DONE]") continue; try { const p = JSON.parse(data); if (p.choices?.[0]?.delta?.content) { full += p.choices[0].delta.content; controller.enqueue(encoder.encode(p.choices[0].delta.content)); } if (p.usage) usageInfo = { tokens: p.usage.total_tokens, cost: p.usage.cost }; if (p.id) generationId = p.id; } catch {} } }
          // Final parse attempt
          if (!usageInfo.tokens && buffer.trim().startsWith("data:")) { try { const p = JSON.parse(buffer.trim().slice(5)); if (p.usage) usageInfo = { tokens: p.usage.total_tokens, cost: p.usage.cost }; } catch {} }
          await settleAttempt(finalAttemptId!, generationId, usageInfo.cost ? BigInt(Math.round(usageInfo.cost * 1_000_000)) : 0n, usageInfo.tokens ?? 0);
          streamCompleted = true;
        }
      } catch (e: any) {
        // fetch() was initiated → provider may have charged → RECONCILIATION_REQUIRED
        if (fetchWasInitiated && finalAttemptId) {
          await markAttemptReconciliationRequired(finalAttemptId, generationId, e.message);
          releaseUsageReservation(usageEventId).catch(() => {}); // release the RESERVED event; attempt holds reconciliation
        } else {
          // Failed before fetch() → safe to release
          await releaseUsageReservation(usageEventId).catch(() => {});
          if (finalAttemptId) await markAttemptFailed(finalAttemptId, e.message);
        }
        const msg = `\n\n[error] ${e.message || "stream failed"}`;
        full += msg; controller.enqueue(encoder.encode(msg));
      } finally {
        const actualCost = usageInfo.cost ?? 0;
        settleDailySpend(ws.id, estMicros, BigInt(Math.round(actualCost * 1_000_000))).catch(() => {});
        cleanup();

        if (!skipStore && conversationId && full) {
          await prisma.message.create({ data: { conversationId, role: "assistant", content: full, model: model.id } }).catch(() => {});
        }

        if (streamCompleted) {
          await recordUsageSettled(usageEventId, ws.id, model.id, model.credits, { tokens: usageInfo.tokens, cost: usageInfo.cost, generationId: generationId ?? undefined }).catch(() => {});
          creditsHeld = 0;
        } else if (!fetchWasInitiated) {
          refundCredits(ws.id, creditsHeld).catch(() => {});
          creditsHeld = 0;
        }
        // If fetch was initiated but no streamCompleted: credits stay reserved, attempt is RECONCILIATION_REQUIRED

        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate", "X-Accel-Buffering": "no", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}
