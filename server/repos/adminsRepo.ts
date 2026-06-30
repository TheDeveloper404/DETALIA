// Repo admin — magic link (token one-time) + sesiuni, ambele cheiate pe EMAIL (allowlist în env, fără
// tabel de conturi). Singura zonă cu acces Drizzle pe `admin_login_tokens` / `admin_sessions`.
import { and, eq, gt, lt } from "drizzle-orm";

import { db } from "@/db";
import { adminLoginTokens, adminSessions } from "@/db/schema";

// ── Magic link tokens ──
export async function insertAdminLoginToken(token: string, email: string, expires: Date) {
  await db.insert(adminLoginTokens).values({ token, email, expires });
}

// Consumă un token (one-time): îl întoarce DOAR dacă e valid + neexpirat, apoi îl șterge. null altfel.
export async function consumeAdminLoginToken(token: string): Promise<string | null> {
  const [row] = await db
    .select({ email: adminLoginTokens.email })
    .from(adminLoginTokens)
    .where(and(eq(adminLoginTokens.token, token), gt(adminLoginTokens.expires, new Date())))
    .limit(1);
  // Ștergem mereu token-ul cerut (consumat sau expirat) — one-time, fără reutilizare.
  await db.delete(adminLoginTokens).where(eq(adminLoginTokens.token, token));
  return row?.email ?? null;
}

// ── Sesiuni ──
export async function insertAdminSession(token: string, email: string, expires: Date) {
  await db.insert(adminSessions).values({ token, email, expires });
}

// Emailul sesiunii valide (neexpirate) sau null.
export async function getValidAdminSessionEmail(token: string): Promise<string | null> {
  const [row] = await db
    .select({ email: adminSessions.email })
    .from(adminSessions)
    .where(and(eq(adminSessions.token, token), gt(adminSessions.expires, new Date())))
    .limit(1);
  return row?.email ?? null;
}

export async function deleteAdminSession(token: string) {
  await db.delete(adminSessions).where(eq(adminSessions.token, token));
}

// Curățenie best-effort a token-urilor + sesiunilor expirate (apelată ocazional la login).
export async function deleteExpiredAdminAuth() {
  const now = new Date();
  await db.delete(adminLoginTokens).where(lt(adminLoginTokens.expires, now));
  await db.delete(adminSessions).where(lt(adminSessions.expires, now));
}
