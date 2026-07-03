export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_TEXT_CHARS = 100_000;

const TEXT_EXTENSIONS = [
  "txt", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "xml", "html", "htm",
  "js", "ts", "tsx", "jsx", "py", "rb", "go", "rs", "java", "c", "h", "cpp", "cs",
  "php", "sh", "sql", "css", "scss", "log", "env", "toml", "ini",
];

function ext(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

export function isSupported(name: string, mime: string) {
  const e = ext(name);
  if (e === "pdf" || e === "docx" || TEXT_EXTENSIONS.includes(e)) return true;
  if (mime.startsWith("text/") || mime === "application/json") return true;
  if (mime === "application/pdf") return true;
  if (mime.includes("wordprocessingml")) return true;
  return false;
}

export type ParsedFile = { name: string; text: string; chars: number; truncated: boolean };

export async function parseFile(name: string, mime: string, buffer: Buffer): Promise<ParsedFile> {
  const e = ext(name);
  let text = "";

  if (e === "pdf" || mime === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
  } else if (e === "docx" || mime.includes("wordprocessingml")) {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    text = buffer.toString("utf8");
  }

  text = text.replace(/\u0000/g, "").trim();
  const truncated = text.length > MAX_TEXT_CHARS;
  if (truncated) text = text.slice(0, MAX_TEXT_CHARS) + "\n\n[...truncated...]";

  return { name, text, chars: text.length, truncated };
}
