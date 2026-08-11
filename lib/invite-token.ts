// Token opac de invitație la proiect — generare, izolat (fără `next/headers`, ca să poată fi
// importat și din contexte care nu au nevoie de cookie-uri, ex. server actions de join).
//
// Stocat BRUT în DB (nu hash — vezi comentariul din db/schema.ts la `projects.inviteToken` pentru
// motiv): e un link de partajare persistent, nu o credențială de autentificare one-time. Entropia
// (32 bytes = 256 biți random, aceeași ca la tokenurile de admin, lib/admin-auth.ts) e apărarea —
// neghicibil, nu needevoalabil.
import { randomBytes } from "node:crypto";

import { INVITE_TOKEN_BYTES } from "@/server/domain/project";

export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString("hex");
}

// SEC-006 (audit 2026-08-11): linkul de invitație era permanent, fără termen — decis: TTL 3 zile,
// ajustabil din env (același tipar ca ADMIN_SESSION_TTL_HOURS/MAGIC_LINK_TTL_MINUTES).
// Găsit la /code-review QODO (2026-08-11): `Number(env) || 3` accepta orice valoare trece prin
// `Number()` fără să fie NaN/0 — o valoare negativă (ex. "-1") ar fi expirat tokenurile INSTANT,
// silențios. Clamp explicit [1, 30] zile; orice valoare în afara intervalului (sau invalidă) → default 3.
function parseTtlDays(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 30) return 3;
  return n;
}
const INVITE_TOKEN_TTL_DAYS = parseTtlDays(process.env.PROJECT_INVITE_TTL_DAYS);

export function isInviteTokenExpired(createdAt: Date): boolean {
  const ageMs = Date.now() - createdAt.getTime();
  return ageMs > INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
}
