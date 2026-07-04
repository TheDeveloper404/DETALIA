// Repo admin — magic link (token one-time) + sesiuni, ambele cheiate pe EMAIL (allowlist în env, fără
// tabel de conturi). Singura zonă cu acces Drizzle pe `admin_login_tokens` / `admin_sessions`.
import { and, eq, gt, lt } from "drizzle-orm";

import { db } from "@/db";
import { adminLoginTokens, adminSessions } from "@/db/schema";

// ── Magic link tokens ──
export async function insertAdminLoginToken(token: string, email: string, expires: Date) {
  await db.insert(adminLoginTokens).values({ token, email, expires });
}

// Consumă un token (one-time) ATOMIC: DELETE … WHERE valid+neexpirat RETURNING email. Postgres serializează
// ștergerea rândului → din două cereri concurente cu ACELAȘI token (dublu-click pe fallback, retry AutoVerify,
// prefetch) DOAR una primește email-ul (și creează sesiune); a doua nu întoarce nimic → null. SELECT-apoi-DELETE
// separat (varianta veche) lăsa o fereastră în care ambele citeau tokenul valid → două sesiuni de admin.
// (neon-http nu are tranzacții → soluția e single-statement, nu SELECT+DELETE în BEGIN/COMMIT.)
export async function consumeAdminLoginToken(token: string): Promise<string | null> {
  const [row] = await db
    .delete(adminLoginTokens)
    .where(and(eq(adminLoginTokens.token, token), gt(adminLoginTokens.expires, new Date())))
    .returning({ email: adminLoginTokens.email });
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
