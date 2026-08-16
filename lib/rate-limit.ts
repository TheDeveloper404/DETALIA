// SEC-01 — Rate limiting distribuit (serverless) peste Upstash Redis.
//
// Serverless pe Vercel nu are memorie partajată între invocări → limiterul trebuie să fie distribuit.
// Folosim @upstash/ratelimit cu sliding window (atomic în Redis).
//
// Filozofie de eșec — depinde de mediu (un control de securitate care lipsește/pică NU trebuie să se
// dezactiveze TĂCUT în producție):
//   • producție  → FAIL-CLOSED: lipsa env-ului Upstash sau un outage Redis ⇒ blocăm (RateLimited).
//   • dev/preview→ FAIL-OPEN: dezvoltarea locală fără Redis trebuie să meargă fără fricțiune.
// Escape hatch: RATE_LIMIT_FAIL_OPEN=true forțează fail-open și în prod (decizie conștientă, documentată).
// PII (email) NU intră în Redis: hash SHA-256.

import { createHash } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

import { audit } from "@/lib/audit";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

// Fail-open doar dacă NU suntem în producție SAU s-a cerut explicit prin env. Altfel fail-closed.
const FAIL_OPEN =
  process.env.RATE_LIMIT_FAIL_OPEN === "true" || process.env.NODE_ENV !== "production";

if (!redis && process.env.NODE_ENV === "production") {
  // În prod env-urile TREBUIE să existe (integrarea Upstash). Lipsa = misconfigurare.
  console.error(
    FAIL_OPEN
      ? "rate-limit: UPSTASH_REDIS_REST_URL/TOKEN absente în producție — FAIL-OPEN forțat din env (limiter dezactivat)."
      : "rate-limit: UPSTASH_REDIS_REST_URL/TOKEN absente în producție — FAIL-CLOSED (cererile sensibile sunt blocate până se configurează Upstash).",
  );
}

// SEC-03 (audit): escape hatch-ul RATE_LIMIT_FAIL_OPEN=true în producție dezactivează TOATE limiterele
// (auth, admin-login, upload, creare detaliu) fără alt semnal decât console.error la boot — ușor de uitat
// pornit după un debug. Un singur eveniment per cold start, severitate error → ajunge și în PostHog (nu doar
// Vercel Logs), ca alertele reale să-l poată prinde.
if (process.env.RATE_LIMIT_FAIL_OPEN === "true" && process.env.NODE_ENV === "production") {
  audit("rate_limit_disabled_in_prod", { hasRedis: !!redis }, "error");
}

type Window = Parameters<typeof Ratelimit.slidingWindow>[1];

// Namespace pe mediu: același Redis poate fi partajat de local/preview/prod fără ca testele dintr-un
// mediu să consume cotele altuia (chei separate). VERCEL_ENV pe Vercel; NODE_ENV local.
const ENV_NS = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "dev";
const IS_PRODUCTION = process.env.VERCEL_ENV === "production";

function make(max: number, window: Window, prefix: string): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, window),
    prefix: `detalia:rl:${ENV_NS}:${prefix}`,
    analytics: false,
  });
}

// Prag mai relaxat DOAR pe non-producție (preview/dev) pentru limiterele lovite recurent de suita
// e2e (10/h pe createDetail se epuizează rapid la rulări repetate pe același user seedat) — namespace-
// ul de mai sus deja izolează contorul de producție, deci asta nu afectează pragul real din prod.
// `isProduction` injectabil (default: starea reală a mediului) — ca testul să nu depindă de env la
// import-ul modulului.
export function withTestHeadroom(prodMax: number, testMax: number, isProduction = IS_PRODUCTION): number {
  return isProduction ? prodMax : testMax;
}

// Limitele FAZA 1 — centralizate, ușor de ajustat. Generoase pentru uz real, dar opresc flood-ul/abuzul.
export const limiters = {
  // Magic link: poartă publică → cea mai strictă. Pe email (hash) ȘI pe IP.
  authPerEmail: make(5, "1 h", "auth:email"),
  authPerIp: make(20, "1 h", "auth:ip"),
  // Mutații post-auth (validare, comentariu, save/send schiță) per user.
  mutation: make(40, "1 m", "mutation"),
  // Publicare detaliu per user (mai costisitoare: imagine + scrieri DB).
  createDetail: make(withTestHeadroom(10, 100), "1 h", "create-detail"),
  // Cotă de upload (emitere token Blob) per user.
  upload: make(30, "1 h", "upload"),
  // Admin-login (anti-brute-force) — pe username ȘI pe IP. Strict (poartă privilegiată).
  adminLoginPerUser: make(10, "15 m", "admin:login:user"),
  adminLoginPerIp: make(30, "15 m", "admin:login:ip"),
  // SEC-003 (audit 2026-08-11): preview-ul anonim de invitație de proiect (/projects/join/[token]) face
  // un SELECT în DB per request, fără sesiune — pe IP, ca să nu limiteze mai mulți invitați legitimi
  // de pe aceeași rețea folosind ACELAȘI token.
  projectInvitePreviewPerIp: make(30, "1 m", "project-invite-preview:ip"),
} as const;

// SEC-14: hartă inversă limiter→nume, ca să etichetăm evenimentul de audit FĂRĂ a schimba call-site-urile.
const LIMITER_NAMES = new Map<Ratelimit, string>(
  Object.entries(limiters).flatMap(([k, v]) => (v ? [[v, k] as const] : [])),
);

export type LimitResult = { ok: boolean; retryAfterSec?: number };

// Rezultatul când limiterul nu poate decide (lipsă config / outage Redis): fail-open vs fail-closed după mediu.
const UNAVAILABLE: LimitResult = FAIL_OPEN ? { ok: true } : { ok: false, retryAfterSec: 30 };

// Verifică un limiter pentru un identificator. La limiter dezactivat sau eroare Redis → politica de mediu
// (prod = fail-closed, dev = fail-open). PII (email) e deja hash-uit înainte de a ajunge aici.
export async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<LimitResult> {
  if (!limiter) return UNAVAILABLE;
  try {
    const res = await limiter.limit(identifier);
    if (res.success) return { ok: true };
    // SEC-14: cotă depășită → audit (id hash-uit, fără PII brut). Semnal de abuz/volum anormal.
    audit(
      "rate_limited",
      { limiter: LIMITER_NAMES.get(limiter) ?? "unknown", idHash: hashAuditId(identifier) },
      "warning",
    );
    const retryAfterSec = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
    return { ok: false, retryAfterSec };
  } catch (err) {
    // Outage Redis → politica de mediu. Logăm + audităm (fără PII; identifier-ul de email e deja hash).
    console.error(
      `rate-limit: eroare la limiter, ${FAIL_OPEN ? "fail-open" : "fail-closed"}:`,
      err instanceof Error ? err.message : String(err),
    );
    audit(
      "rate_limit_unavailable",
      { limiter: LIMITER_NAMES.get(limiter) ?? "unknown", failOpen: FAIL_OPEN },
      "error",
    );
    return UNAVAILABLE;
  }
}

// Dedup vizualizări (2026-08-09, decizie de produs): dacă ACELAȘI user reîncarcă ACELAȘI detaliu în
// mai puțin de VIEW_DEDUP_WINDOW_SECONDS, nu numărăm a doua oară — altfel un user care revine des la
// propriul draft/detaliu umflă contorul fără ca autorul să știe că a fost un singur om, nu 20.
// SET NX + TTL (atomic în Redis, fără condiție de cursă): prima vizualizare din fereastră reușește să
// scrie cheia (răspuns diferit de null) → o numărăm; următoarele din aceeași fereastră găsesc cheia deja
// scrisă (NX eșuează, răspuns null) → le ignorăm. Fail-OPEN dacă Redis lipsește/pică: preferăm să
// supranumărăm ocazional decât să pierdem tot semnalul de vizualizări (nesensibil la securitate, spre
// deosebire de limiterele de mai sus).
const VIEW_DEDUP_WINDOW_SECONDS = 30 * 60;

// `client` injectabil (default: singleton-ul modulului) — același motiv ca la `checkLimit(limiter, id)`
// mai jos: un test cu Redis REAL ar cere credențiale Upstash indisponibile la `npm test` local; injecția
// lasă testele să acopere toate cele 3 ramuri (fără client / NX reușit / NX eșuat sau eroare) cu un fake.
export async function shouldCountView(key: string, client: Redis | null = redis): Promise<boolean> {
  if (!client) return true;
  try {
    const result = await client.set(`detalia:view:${ENV_NS}:${key}`, "1", {
      nx: true,
      ex: VIEW_DEDUP_WINDOW_SECONDS,
    });
    return result !== null;
  } catch (err) {
    console.error(
      "view-dedup: eroare Redis, fail-open (numărăm oricum):",
      err instanceof Error ? err.message : String(err),
    );
    return true;
  }
}

// Hash SHA-256 pentru email — nu stocăm PII în Redis. Normalizăm (lowercase/trim) ca să fie stabil.
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

// SEC-14: hash scurt al unui identificator (IP/email/userId) pentru audit → corelabil, dar opac (fără PII brut).
export function hashAuditId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

// IP-ul clientului din headerele de proxy (Vercel pune x-forwarded-for). Primul IP din listă.
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
