import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SESSION_COOKIE = "nebula_session";
const HOST_SESSION_COOKIE = "__Host-nebula_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export function hashPassword(value: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(value, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPasswordHash(value: string, stored: string) {
  if (!stored || !stored.startsWith("scrypt$")) return false;
  const [, salt, derived] = stored.split("$");
  if (!salt || !derived) return false;
  const candidate = scryptSync(value, salt, 64);
  const expected = Buffer.from(derived, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "U"
  );
}

function cookieName() {
  return process.env.NODE_ENV === "production" ? HOST_SESSION_COOKIE : SESSION_COOKIE;
}

export async function createSession(userId: string) {
  const token = randomUUID();
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.session.create({
    data: { token, userId, expiresAt: new Date(Date.now() + MAX_AGE * 1000) },
  });
  return token;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(cookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(cookieName(), "", { path: "/", maxAge: 0 });
}

export async function getSessionToken() {
  const store = await cookies();
  return store.get(HOST_SESSION_COOKIE)?.value || store.get(SESSION_COOKIE)?.value || null;
}

export async function currentUser() {
  const token = await getSessionToken();
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { workspace: true } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return session.user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Authentication required");
  return user;
}

export async function destroySession(token: string) {
  await prisma.session.deleteMany({ where: { token } });
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateApiKey() {
  const raw = randomBytes(24).toString("hex");
  const key = `nb-${raw}`;
  return { key, prefix: key.slice(0, 10), hash: hashApiKey(key) };
}
