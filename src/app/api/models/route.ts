import { CHAT_MODELS, IMAGE_MODELS, IMAGE_STYLES } from "@/lib/models";
import { json } from "@/lib/http";

export async function GET() {
  return json({ chat: CHAT_MODELS, image: IMAGE_MODELS, styles: IMAGE_STYLES });
}
