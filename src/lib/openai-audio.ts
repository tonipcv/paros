import { parseBuffer } from "music-metadata";

export function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

// Worst-case fallback bitrate (16 kbps) used only when metadata has no duration
// and no bitrate — ensures the estimated cost is never understated.
const FALLBACK_BYTES_PER_SECOND = 2_000;

export async function audioDurationSeconds(file: Blob): Promise<number | null> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = await parseBuffer(buffer, file.type || undefined, { duration: true, skipCovers: true });
    const seconds = metadata.format.duration;
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) return seconds;
    const bitrate = metadata.format.bitrate;
    if (typeof bitrate === "number" && bitrate > 0) return buffer.length / (bitrate / 8);
    // Only trust the conservative byte-based estimate when the format was
    // positively identified; unparseable content fails closed (null).
    if (typeof metadata.format.container === "string" && metadata.format.container.length > 0) {
      return buffer.length / FALLBACK_BYTES_PER_SECOND;
    }
    return null;
  } catch {
    return null;
  }
}

export async function textToSpeech(text: string, voice = "alloy") {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "tts-1", voice, input: text.slice(0, 4000), format: "mp3" }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`TTS error ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.arrayBuffer();
}

export async function speechToText(file: Blob) {
  const form = new FormData();
  form.append("file", file, "audio.webm");
  form.append("model", "whisper-1");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`STT error ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.text as string;
}
