import { prisma } from "./prisma";

const API = "https://api.telegram.org";
const SEND_TIMEOUT_MS = 10_000;

export function saasName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME || "KRX";
}

// Notifications always go to the admin private chat.
export function telegramChatId(): string | null {
  return process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || null;
}

// Best-effort: never throws and never blocks critical paths (fire-and-forget).
export async function sendTelegramMessage(chatId: string | number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: String(chatId), text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`telegram sendMessage failed: ${res.status} ${body.slice(0, 500)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("telegram sendMessage error:", e);
    return false;
  }
}

// Dispatches when a signup becomes verified. `source` identifies the channel
// (e.g. "email", "Google") when the account is born verified.
export async function notifySignupVerified(email: string, source?: string): Promise<boolean> {
  const chatId = telegramChatId();
  if (!chatId) return false;
  const suffix = source ? ` (via ${source})` : "";
  return sendTelegramMessage(chatId, `${saasName()} - Novo cadastro confirmado${suffix}: ${email}`);
}

function formatDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

// Sends the daily statistics report in the shared Telegram model. Never throws.
export async function sendStats(): Promise<boolean> {
  const chatId = telegramChatId();
  if (!chatId) return false;
  const now = new Date();
  const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startWeek = new Date(startToday.getTime() - 6 * 86_400_000);
  try {
    const [total, verified, createdToday, verifiedToday, createdWeek, verifiedWeek] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: { not: null } } }),
      prisma.user.count({ where: { createdAt: { gte: startToday } } }),
      prisma.user.count({ where: { emailVerified: { gte: startToday } } }),
      prisma.user.count({ where: { createdAt: { gte: startWeek } } }),
      prisma.user.count({ where: { emailVerified: { gte: startWeek } } }),
    ]);
    const text = [
      `${saasName()} - Estatísticas ${formatDate(now)}`,
      "",
      `Total de usuários: ${total}`,
      `Verificados: ${verified}`,
      `Pendentes: ${total - verified}`,
      "",
      `Cadastros hoje: ${createdToday}`,
      `Verificados hoje: ${verifiedToday}`,
      `Cadastros em 7 dias: ${createdWeek}`,
      `Verificados em 7 dias: ${verifiedWeek}`,
    ].join("\n");
    return sendTelegramMessage(chatId, text);
  } catch (e) {
    console.error("telegram sendStats failed:", e);
    return false;
  }
}
