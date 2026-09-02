// Repo admin — magic link (token one-time) + sesiuni, ambele cheiate pe EMAIL (allowlist în env, fără
// tabel de conturi). Singura zonă cu acces Drizzle pe `admin_login_tokens` / `admin_sessions` /
// `admin_pending_sessions`.
import { and, eq, gt, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { adminLoginTokens, adminPendingSessions, adminSessions } from "@/db/schema";

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

// ── Sesiuni INTERMEDIARE (SEC-P02) ──
// Magic link consumat, al doilea factor încă neverificat. Zero privilegii: nicio cale nu le acceptă în
// afară de /admin-page/totp. Tabel separat de `admin_sessions` — vezi invariantul din `db/schema.ts`.
export async function insertAdminPendingSession(token: string, email: string, expires: Date) {
  await db.insert(adminPendingSessions).values({ token, email, expires });
}

export type AdminPendingSession = { email: string; attempts: number };

export async function getValidAdminPendingSession(token: string): Promise<AdminPendingSession | null> {
  const [row] = await db
    .select({ email: adminPendingSessions.email, attempts: adminPendingSessions.attempts })
    .from(adminPendingSessions)
    .where(and(eq(adminPendingSessions.token, token), gt(adminPendingSessions.expires, new Date())))
    .limit(1);
  return row ?? null;
}

// Incrementează ATOMIC contorul de încercări greșite și întoarce noua valoare (`null` = sesiune
// inexistentă/expirată). `x = x + 1` citit-apoi-scris ar pierde încercări la cereri concurente — exact
// ce ar exploata un atacator care trage coduri în paralel pe aceeași sesiune intermediară.
export async function bumpAdminPendingAttempts(token: string): Promise<number | null> {
  const [row] = await db
    .update(adminPendingSessions)
    .set({ attempts: sql`${adminPendingSessions.attempts} + 1` })
    .where(and(eq(adminPendingSessions.token, token), gt(adminPendingSessions.expires, new Date())))
    .returning({ attempts: adminPendingSessions.attempts });
  return row?.attempts ?? null;
}

// Consumă ATOMIC sesiunea intermediară: DELETE … WHERE valid+neexpirat RETURNING email. Același motiv
// ca la `consumeAdminLoginToken` — din două cereri concurente care trec simultan verificarea codului,
// doar una primește emailul (și deci doar una creează sesiune completă).
export async function consumeAdminPendingSession(token: string): Promise<string | null> {
  const [row] = await db
    .delete(adminPendingSessions)
    .where(and(eq(adminPendingSessions.token, token), gt(adminPendingSessions.expires, new Date())))
    .returning({ email: adminPendingSessions.email });
  return row?.email ?? null;
}

export async function deleteAdminPendingSession(token: string) {
  await db.delete(adminPendingSessions).where(eq(adminPendingSessions.token, token));
}

// Invalidează TOATE sesiunile intermediare ale unui email — apelată la promovarea în sesiune completă
// (o singură cerere de login nu trebuie să lase în urmă alte jumătăți de autentificare deschise).
export async function deleteAdminPendingSessionsForEmail(email: string) {
  await db.delete(adminPendingSessions).where(eq(adminPendingSessions.email, email));
}

// Curățenie best-effort a token-urilor + sesiunilor expirate (apelată ocazional la login).
export async function deleteExpiredAdminAuth() {
  const now = new Date();
  await db.delete(adminLoginTokens).where(lt(adminLoginTokens.expires, now));
  await db.delete(adminSessions).where(lt(adminSessions.expires, now));
  await db.delete(adminPendingSessions).where(lt(adminPendingSessions.expires, now));
}
