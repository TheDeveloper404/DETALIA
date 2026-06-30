// Autentificare ADMIN — complet separată de Auth.js (userii passwordless).
// CINE e admin = allowlist `ADMIN_EMAILS` (env). Login = MAGIC LINK propriu pe email (token one-time în DB),
// sesiune proprie (cookie HttpOnly dedicat, token opac validat în admin_sessions — revocabil, expiră).
// Rulează DOAR în runtime Node (server actions / RSC / route handlers).
import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { isAdminEmail } from "@/lib/admin-allowlist";
import {
  consumeAdminLoginToken,
  deleteAdminSession,
  deleteExpiredAdminAuth,
  getValidAdminSessionEmail,
  insertAdminLoginToken,
  insertAdminSession,
} from "@/server/repos/adminsRepo";

export { isAdminEmail };

const COOKIE = "detalia-admin-session";
// TTL sesiune (ore) și TTL magic link (minute) — tunable din env, cu default-uri sigure.
const SESSION_TTL_MS = (Number(process.env.ADMIN_SESSION_TTL_HOURS) || 8) * 60 * 60 * 1000;
const LINK_TTL_MS = (Number(process.env.ADMIN_LOGIN_TOKEN_TTL_MINUTES) || 15) * 60 * 1000;

// ── Magic link ──
// Emite un token one-time pentru un email de admin și întoarce URL-ul de verificare absolut.
// Callerul a verificat deja că emailul e în allowlist.
export async function createAdminLoginUrl(email: string, origin: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + LINK_TTL_MS);
  await insertAdminLoginToken(token, email.trim().toLowerCase(), expires);
  void deleteExpiredAdminAuth().catch(() => {});
  return `${origin}/admin-page/verify?token=${token}`;
}

export function adminLinkTtlMinutes(): number {
  return Math.round(LINK_TTL_MS / 60000);
}

// Consumă token-ul de magic link → creează sesiune dacă emailul e (încă) în allowlist. Întoarce ok.
// Re-verificăm allowlist-ul la consum: un email scos din ADMIN_EMAILS între timp NU mai primește sesiune.
export async function verifyAdminLoginToken(token: string): Promise<boolean> {
  const email = await consumeAdminLoginToken(token);
  if (!email || !isAdminEmail(email)) return false;
  await createAdminSession(email);
  return true;
}

// ── Sesiune ──
export type AdminSession = { email: string };

export async function createAdminSession(email: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await insertAdminSession(token, email.trim().toLowerCase(), expires);

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin-page",
    expires,
  });
}

// Sesiunea de admin curentă (din cookie, validată în DB ȘI re-verificată în allowlist) sau null.
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const email = await getValidAdminSessionEmail(token);
  if (!email || !isAdminEmail(email)) return null;
  return { email };
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await deleteAdminSession(token);
  store.delete({ name: COOKIE, path: "/admin-page" });
}
