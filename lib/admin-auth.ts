// Autentificare ADMIN — complet separată de Auth.js (userii passwordless).
// CINE e admin = allowlist `ADMIN_EMAILS` (env). Login = MAGIC LINK propriu pe email (token one-time în DB),
// sesiune proprie (cookie HttpOnly dedicat, token opac validat în admin_sessions — revocabil, expiră).
// Rulează DOAR în runtime Node (server actions / RSC / route handlers).
import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { isAdminEmail } from "@/lib/admin-allowlist";
import { hashToken } from "@/lib/admin-token-hash";
import {
  bumpAdminPendingAttempts,
  consumeAdminLoginToken,
  consumeAdminPendingSession,
  deleteAdminPendingSession,
  deleteAdminPendingSessionsForEmail,
  deleteAdminSession,
  deleteExpiredAdminAuth,
  getValidAdminPendingSession,
  getValidAdminSessionEmail,
  insertAdminLoginToken,
  insertAdminPendingSession,
  insertAdminSession,
} from "@/server/repos/adminsRepo";

export { isAdminEmail };

const COOKIE = "detalia-admin-session";
// Cookie DISTINCT pentru sesiunea intermediară (SEC-P02) — nu reciclăm numele celui complet: dacă
// numele ar coincide, orice cale care doar verifică „există cookie-ul" ar confunda jumătatea de
// autentificare cu întregul.
const PENDING_COOKIE = "detalia-admin-pending";
// TTL sesiune (ore) și TTL magic link (minute) — tunable din env, cu default-uri sigure.
const SESSION_TTL_MS = (Number(process.env.ADMIN_SESSION_TTL_HOURS) || 8) * 60 * 60 * 1000;
const LINK_TTL_MS = (Number(process.env.ADMIN_LOGIN_TOKEN_TTL_MINUTES) || 15) * 60 * 1000;
// Fereastra în care adminul are timp să deschidă authenticatorul. Scurtă intenționat: o sesiune
// intermediară e un magic link deja consumat care așteaptă doar 6 cifre.
const PENDING_TTL_MS = (Number(process.env.ADMIN_PENDING_TTL_MINUTES) || 5) * 60 * 1000;
// Câte coduri greșite omoară sesiunea intermediară. Rate-limitul din Redis apără emailul și IP-ul la
// nivel global; pragul ăsta forțează atacatorul înapoi prin inbox (un magic link nou) după câteva
// greșeli, în loc să-l lase să aștepte resetarea cotei pe aceeași jumătate de autentificare.
export const MAX_PENDING_TOTP_ATTEMPTS = 5;

// Hash-ul trăiește în `lib/admin-token-hash.ts` — îl folosește și poarta de admin din `proxy.ts`,
// care nu poate importa fișierul ăsta (trage `next/headers`). Re-exportat aici ca importurile
// existente (inclusiv e2e) să rămână valabile. Vezi motivația completă în modulul respectiv.
export { hashToken };

// ── Magic link ──
// Emite un token one-time pentru un email de admin și întoarce URL-ul de verificare absolut.
// Callerul a verificat deja că emailul e în allowlist.
export async function createAdminLoginUrl(email: string, origin: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + LINK_TTL_MS);
  await insertAdminLoginToken(hashToken(token), email.trim().toLowerCase(), expires);
  void deleteExpiredAdminAuth().catch(() => {});
  return `${origin}/admin-page/verify?token=${token}`;
}

export function adminLinkTtlMinutes(): number {
  return Math.round(LINK_TTL_MS / 60000);
}

// Consumă token-ul de magic link → creează sesiunea INTERMEDIARĂ (SEC-P02), nu una completă: magic
// link-ul e doar PRIMUL factor. Accesul real apare abia după TOTP, la `promoteAdminPendingSession`.
// Re-verificăm allowlist-ul la consum: un email scos din ADMIN_EMAILS între timp nu mai primește nimic.
export async function verifyAdminLoginToken(token: string): Promise<boolean> {
  const email = await consumeAdminLoginToken(hashToken(token));
  if (!email || !isAdminEmail(email)) return false;
  await createAdminPendingSession(email);
  return true;
}

// ── Sesiune ──
export type AdminSession = { email: string };

async function createAdminSession(email: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await insertAdminSession(hashToken(token), email.trim().toLowerCase(), expires);

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
  const email = await getValidAdminSessionEmail(hashToken(token));
  if (!email || !isAdminEmail(email)) return null;
  return { email };
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await deleteAdminSession(hashToken(token));
  store.delete({ name: COOKIE, path: "/admin-page" });
  // La logout curățăm și eventuala jumătate de autentificare rămasă — altfel un pending viu ar lăsa
  // deschisă pagina de TOTP după ce adminul crede că a ieșit complet.
  await destroyAdminPendingSession();
}

// ── Sesiune intermediară (SEC-P02) ──
export type AdminPendingSessionInfo = { email: string; attempts: number };

async function createAdminPendingSession(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  // O cerere nouă de login invalidează jumătățile de autentificare anterioare ale aceluiași email.
  await deleteAdminPendingSessionsForEmail(normalized);

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + PENDING_TTL_MS);
  await insertAdminPendingSession(hashToken(token), normalized, expires);

  const store = await cookies();
  store.set(PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin-page",
    expires,
  });
}

// Sesiunea intermediară curentă (validată în DB ȘI re-verificată în allowlist) sau null.
export async function getAdminPendingSession(): Promise<AdminPendingSessionInfo | null> {
  const store = await cookies();
  const token = store.get(PENDING_COOKIE)?.value;
  if (!token) return null;
  const row = await getValidAdminPendingSession(hashToken(token));
  if (!row || !isAdminEmail(row.email)) return null;
  return row;
}

export async function destroyAdminPendingSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(PENDING_COOKIE)?.value;
  if (token) await deleteAdminPendingSession(hashToken(token));
  store.delete({ name: PENDING_COOKIE, path: "/admin-page" });
}

// Al doilea factor a trecut → schimbăm jumătatea de autentificare pe una completă.
// Consumul e ATOMIC pe rândul de pending: `DELETE ... RETURNING` (prin `getValid` + `delete` nu s-ar
// putea, deci ștergem întâi și creăm sesiunea DOAR dacă ștergerea a găsit efectiv rândul) — două cereri
// concurente care trec simultan verificarea codului nu pot produce două sesiuni complete.
export async function promoteAdminPendingSession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(PENDING_COOKIE)?.value;
  if (!token) return null;

  const email = await consumeAdminPendingSession(hashToken(token));
  if (!email || !isAdminEmail(email)) return null;

  store.delete({ name: PENDING_COOKIE, path: "/admin-page" });
  await createAdminSession(email);
  return email;
}

// Înregistrează un cod greșit. Peste prag, sesiunea intermediară moare — adminul o ia de la magic link.
// Întoarce numărul de încercări rămase (0 = sesiune închisă).
export async function registerFailedTotpAttempt(): Promise<number> {
  const store = await cookies();
  const token = store.get(PENDING_COOKIE)?.value;
  if (!token) return 0;

  const attempts = await bumpAdminPendingAttempts(hashToken(token));
  if (attempts === null) return 0;
  if (attempts >= MAX_PENDING_TOTP_ATTEMPTS) {
    await destroyAdminPendingSession();
    return 0;
  }
  return MAX_PENDING_TOTP_ATTEMPTS - attempts;
}
