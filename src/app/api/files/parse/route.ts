import { requireUser } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { parseFile, isSupported, MAX_FILE_BYTES } from "@/lib/file-parse";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return error("File required");

    const name = (file as File).name || "file";
    const mime = file.type || "";
    if (file.size > MAX_FILE_BYTES) return error("File too large (max 10MB)", 413);
    if (!isSupported(name, mime)) return error(`Unsupported file type: ${name}`, 415);

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseFile(name, mime, buffer);
    if (!parsed.text) return error("Could not extract text from file", 422);
    return json(parsed);
  } catch (e: any) {
    return error(e.message || "Parse failed", 500);
  }
}
