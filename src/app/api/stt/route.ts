import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser, reserveCredits, refundCredits, recordUsage } from "@/lib/account";
import { error, json, handleRouteError } from "@/lib/http";
import { hasOpenAI, speechToText } from "@/lib/openai-audio";
import { CREDITS } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    if (!hasOpenAI()) return error("Voice is not configured (OPENAI_API_KEY missing)", 503);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return error("Audio file required");

    if (!(await reserveCredits(ws.id, CREDITS.stt))) return error("Insufficient credits", 402);
    try {
      const text = await speechToText(file);
      await recordUsage(ws.id, "stt", "whisper-1", CREDITS.stt).catch((e) => console.error("recordUsage failed:", e));
      return json({ text });
    } catch (e) {
      await refundCredits(ws.id, CREDITS.stt).catch((refundErr) => console.error("refundCredits failed:", refundErr));
      throw e;
    }
  } catch (e) {
    return handleRouteError(e);
  }
}
