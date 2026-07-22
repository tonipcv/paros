const BASE_URL = "https://fal.run";

export function hasFal() {
  return Boolean(process.env.FAL_KEY);
}

export async function generateImage(
  modelId: string,
  prompt: string,
  inputImage?: string
): Promise<string> {
  const key = process.env.FAL_KEY || "";
  const body: Record<string, unknown> = {
    prompt,
    enable_safety_checker: false,
    image_size: "landscape_4_3",
    num_images: 1,
    output_format: "png",
  };
  if (inputImage) body.image_url = inputImage;

  const res = await fetch(`${BASE_URL}/${modelId}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fal.ai error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const url: string | undefined = data.images?.[0]?.url;
  if (!url) throw new Error("No image returned by Fal.ai");
  return url;
}
