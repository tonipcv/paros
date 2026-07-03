import { clearSessionCookie, destroySession, getSessionToken } from "@/lib/auth";
import { json } from "@/lib/http";

export async function POST() {
  const token = await getSessionToken();
  if (token) await destroySession(token);
  await clearSessionCookie();
  return json({ ok: true });
}
