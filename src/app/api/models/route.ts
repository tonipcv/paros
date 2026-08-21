import { CHAT_MODELS, IMAGE_MODELS, IMAGE_STYLES } from "@/lib/models";
import { json } from "@/lib/http";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams.get("search")?.trim().toLowerCase();
  const matches = (model: { id: string; name: string; provider?: string }) => !search
    || `${model.id} ${model.name} ${model.provider || ""}`.toLowerCase().includes(search);
  return json({
    chat: CHAT_MODELS.filter(matches),
    image: IMAGE_MODELS.filter(matches),
    styles: search ? [] : IMAGE_STYLES,
  });
}
