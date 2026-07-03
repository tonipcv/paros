import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser, chargeCredits } from "@/lib/account";
import { error, json } from "@/lib/http";
import { hasOpenAI, speechToText } from "@/lib/openai-audio";
import { CREDITS } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    if (!hasOpenAI()) return error("Voice não configurado (OPENAI_API_KEY ausente)", 503);
    if (ws.credits < CREDITS.stt) return error("Insufficient credits", 402);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return error("Audio file required");

    const text = await speechToText(file);
    await chargeCredits(ws.id, "stt", "whisper-1", CREDITS.stt).catch(() => {});
    return json({ text });
  } catch (e: any) {
    return error(e.message || "STT failed", 500);
  }
}
