import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser, chargeCredits } from "@/lib/account";
import { error } from "@/lib/http";
import { hasOpenAI, textToSpeech } from "@/lib/openai-audio";
import { CREDITS } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    if (!hasOpenAI()) return error("Voice não configurado (OPENAI_API_KEY ausente)", 503);
    if (ws.credits < CREDITS.tts) return error("Insufficient credits", 402);

    const body = await request.json();
    const text = String(body.text || "").trim();
    const voice = String(body.voice || "alloy");
    if (!text) return error("Text required");

    const audio = await textToSpeech(text, voice);
    await chargeCredits(ws.id, "tts", "tts-1", CREDITS.tts).catch(() => {});
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" },
    });
  } catch (e: any) {
    return error(e.message || "TTS failed", 500);
  }
}
