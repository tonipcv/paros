import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser, reserveCredits, refundCredits, recordUsage } from "@/lib/account";
import { error } from "@/lib/http";
import { hasOpenAI, textToSpeech } from "@/lib/openai-audio";
import { CREDITS } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    if (!hasOpenAI()) return error("Voice is not configured (OPENAI_API_KEY missing)", 503);

    const body = await request.json();
    const text = String(body.text || "").trim();
    const voice = String(body.voice || "alloy");
    if (!text) return error("Text required");

    if (!(await reserveCredits(ws.id, CREDITS.tts))) return error("Insufficient credits", 402);
    try {
      const audio = await textToSpeech(text, voice);
      await recordUsage(ws.id, "tts", "tts-1", CREDITS.tts).catch((e) => console.error("recordUsage failed:", e));
      return new Response(audio, {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" },
      });
    } catch (e) {
      await refundCredits(ws.id, CREDITS.tts).catch((refundErr) => console.error("refundCredits failed:", refundErr));
      throw e;
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Text-to-speech failed";
    return error(message, 500);
  }
}
