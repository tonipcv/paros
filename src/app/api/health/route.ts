import { json } from "@/lib/http";
import { latestSummary } from "@/lib/monitor";

export const runtime = "nodejs";

export async function GET() {
  const summary = await latestSummary();
  return json(summary);
}
