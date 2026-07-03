export function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
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
