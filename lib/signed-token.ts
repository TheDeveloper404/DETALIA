// Token semnat HMAC pentru linkuri care trebuie să funcționeze FĂRĂ sesiune (ex. dezabonarea de la
// digestul săptămânal, dintr-un client de email). Nu e un JWT: payload minim (`<value>.<issuedAt>`) +
// semnătură. `issuedAt` (ms epoch) e semnat împreună cu valoarea și verificat contra unui TTL la
// citire → un token expiră singur, nu doar la rotația `AUTH_SECRET`.
// Cheia se derivă din `AUTH_SECRET` cu domain separation pe `purpose` — un token de „unsubscribe" nu
// poate fi refolosit pe alt scop. `AUTH_SECRET` se rotește trimestrial (CLAUDE.md §Mentenanță);
// rotația invalidează instant orice token deja emis — acceptabil (fiecare digest poartă link proaspăt).
import { createHmac, timingSafeEqual } from "node:crypto";

// TTL implicit: 60 de zile. Acoperă lejer cadența săptămânală a digestului, dar un link scurs dintr-un
// email vechi nu rămâne valabil la nesfârșit.
const DEFAULT_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
// Toleranță pt ceasuri ușor desincronizate între serverul care semnează și cel care verifică.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function key(purpose: string): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET absent — nu pot semna/verifica token-uri.");
  return createHmac("sha256", secret).update(`signed-token:${purpose}`).digest();
}

function sign(purpose: string, payload: string): string {
  return createHmac("sha256", key(purpose)).update(payload).digest("base64url");
}

// Întoarce `"<value>.<issuedAt>.<sig>"`. `value` e un identificator opac (uuid) — fără PII.
export function createSignedToken(purpose: string, value: string): string {
  const payload = `${value}.${Date.now()}`;
  return `${payload}.${sign(purpose, payload)}`;
}

// Întoarce `value` dacă semnătura verifică ȘI tokenul nu e mai vechi de `maxAgeMs`; altfel `null`.
export function verifySignedToken(
  purpose: string,
  token: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [value, issuedAtRaw, sig] = parts;
  if (!value || !issuedAtRaw || !sig) return null;

  const expected = sign(purpose, `${value}.${issuedAtRaw}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return null;
  const age = Date.now() - issuedAt;
  if (age > maxAgeMs || age < -CLOCK_SKEW_MS) return null;

  return value;
}
