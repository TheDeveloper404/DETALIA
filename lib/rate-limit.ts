// SEC-01 — Rate limiting distribuit (serverless) peste Upstash Redis.
//
// Serverless pe Vercel nu are memorie partajată între invocări → limiterul trebuie să fie distribuit.
// Folosim @upstash/ratelimit cu sliding window (atomic în Redis).
//
// Filozofie de eșec: FAIL-OPEN. Dacă Redis nu e configurat (dev fără env) sau pică (outage),
// lăsăm cererea să treacă și logăm — disponibilitatea aplicației > enforce-ul strict pentru un MVP.
// Un blip Redis NU trebuie să blocheze tot login-ul/mutațiile. PII (email) NU intră în Redis: hash SHA-256.

import { createHash } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

if (!redis && process.env.NODE_ENV === "production") {
  // În prod env-urile TREBUIE să existe (integrarea Upstash). Lipsa = misconfigurare → vizibil în loguri.
  console.error("rate-limit: UPSTASH_REDIS_REST_URL/TOKEN absente în producție — limiter DEZACTIVAT (fail-open).");
}

type Window = Parameters<typeof Ratelimit.slidingWindow>[1];

// Namespace pe mediu: același Redis poate fi partajat de local/preview/prod fără ca testele dintr-un
// mediu să consume cotele altuia (chei separate). VERCEL_ENV pe Vercel; NODE_ENV local.
const ENV_NS = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "dev";

function make(max: number, window: Window, prefix: string): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, window),
    prefix: `detalia:rl:${ENV_NS}:${prefix}`,
    analytics: false,
  });
}

// Limitele FAZA 1 — centralizate, ușor de ajustat. Generoase pentru uz real, dar opresc flood-ul/abuzul.
export const limiters = {
  // Magic link: poartă publică → cea mai strictă. Pe email (hash) ȘI pe IP.
  authPerEmail: make(5, "1 h", "auth:email"),
  authPerIp: make(20, "1 h", "auth:ip"),
  // Mutații post-auth (validare, comentariu, save/send schiță) per user.
  mutation: make(40, "1 m", "mutation"),
  // Publicare detaliu per user (mai costisitoare: imagine + scrieri DB).
  createDetail: make(10, "1 h", "create-detail"),
  // Cotă de upload (emitere token Blob) per user.
  upload: make(30, "1 h", "upload"),
} as const;

export type LimitResult = { ok: boolean; retryAfterSec?: number };

// Verifică un limiter pentru un identificator. Fail-open la limiter dezactivat sau eroare Redis.
export async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<LimitResult> {
  if (!limiter) return { ok: true };
  try {
    const res = await limiter.limit(identifier);
    if (res.success) return { ok: true };
    const retryAfterSec = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
    return { ok: false, retryAfterSec };
  } catch (err) {
    // Outage Redis → fail-open, dar logăm (fără PII; identifier-ul de email e deja hash).
    console.error("rate-limit: eroare la limiter, fail-open:", err instanceof Error ? err.message : String(err));
    return { ok: true };
  }
}

// Hash SHA-256 pentru email — nu stocăm PII în Redis. Normalizăm (lowercase/trim) ca să fie stabil.
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

// IP-ul clientului din headerele de proxy (Vercel pune x-forwarded-for). Primul IP din listă.
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
