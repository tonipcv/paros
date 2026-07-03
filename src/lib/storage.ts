import { randomUUID } from "node:crypto";
import { AwsClient } from "aws4fetch";

export function hasR2() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL
  );
}

let client: AwsClient | null = null;
function r2() {
  if (!client) {
    client = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      service: "s3",
      region: "auto",
    });
  }
  return client;
}

// Uploads a data URL (data:image/png;base64,...) to R2 and returns the public URL.
// Falls back to returning the original data URL when R2 is not configured.
export async function uploadImageFromDataUrl(dataUrl: string): Promise<string> {
  if (!hasR2()) return dataUrl;
  const m = /^data:(.+?);base64,(.*)$/s.exec(dataUrl);
  if (!m) return dataUrl;

  const contentType = m[1];
  const bytes = Buffer.from(m[2], "base64");
  const ext = (contentType.split("/")[1] || "png").split("+")[0];
  const key = `images/${randomUUID()}.${ext}`;

  const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${key}`;
  const res = await r2().fetch(endpoint, {
    method: "PUT",
    body: bytes,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`R2 upload failed ${res.status}: ${t.slice(0, 200)}`);
  }

  const base = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");
  return `${base}/${key}`;
}
