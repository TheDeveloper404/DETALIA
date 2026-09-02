// Logica de domeniu a celui de-al doilea factor de admin (SEC-P02) — TOTP RFC 6238 + coduri de rezervă.
// PUR: fără DB, fără env, fără cookies. Tot ce ține de I/O stă în repo/serviciu, ca regulile de mai jos
// (anti-replay, format, fereastră de toleranță) să fie testabile direct, fără infrastructură.
import { createHash, randomBytes } from "node:crypto";

import * as OTPAuth from "otpauth";

// Numele afișat în aplicația de authenticator.
export const TOTP_ISSUER = "DETALIA Admin";
// Default-urile RFC 6238 pe care le implementează TOATE aplicațiile de authenticator (Google, Aegis,
// 1Password, Bitwarden). Nu le schimbăm „ca să fie mai sigur": SHA256/8 cifre e suportat inegal, iar un
// admin care nu-și poate înrola telefonul e o problemă mai mare decât diferența teoretică de securitate.
export const TOTP_ALGORITHM = "SHA1";
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
// Toleranță la derivă de ceas: ±1 pas (±30s). RFC 6238 §5.2 cere fereastra MINIMĂ acceptabilă — fiecare
// pas în plus multiplică codurile valide simultan, deci și șansa unui brute-force.
export const TOTP_WINDOW = 1;

// ── Coduri de rezervă ──
// Alfabet fără caractere ambigue la citit de pe hârtie (I/L/O/U scoase). Exact 32 de simboluri → un octet
// aleator mascat cu 31 alege uniform, fără bias de modulo.
const BACKUP_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BACKUP_CODE_LENGTH = 10; // 10 × 5 biți = 50 biți de entropie per cod
export const BACKUP_CODE_COUNT = 10;

// `XXXXX-XXXXX` — cratima e doar cosmetică (se ignoră la normalizare).
export function generateBackupCode(): string {
  const bytes = randomBytes(BACKUP_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < BACKUP_CODE_LENGTH; i++) out += BACKUP_ALPHABET[bytes[i] & 31];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, generateBackupCode);
}

// Tolerantă la felul în care oamenii transcriu de pe hârtie: litere mici, spații, cratime lipsă, plus
// confuziile clasice I/L→1 și O→0 (caractere care nici nu există în alfabetul nostru, deci maparea nu
// poate produce coliziuni cu un cod legitim).
export function normalizeBackupCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
}

// SHA-256 simplu (nu bcrypt/argon2): codurile sunt valori random de 50 de biți generate de noi, nu parole
// alese de om — nu există dicționar de atacat, deci întărirea cu KDF n-ar cumpăra nimic. Același
// raționament ca la tokenurile de magic link.
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}

export function isValidBackupCodeFormat(input: string): boolean {
  const normalized = normalizeBackupCode(input);
  if (normalized.length !== BACKUP_CODE_LENGTH) return false;
  return [...normalized].every((c) => BACKUP_ALPHABET.includes(c));
}

// ── Coduri TOTP ──
export function normalizeTotpCode(input: string): string {
  return input.replace(/\D/g, "");
}

export function isValidTotpCodeFormat(input: string): boolean {
  // `normalizeTotpCode` a scos deja tot ce nu e cifră → rămâne doar lungimea de verificat.
  return normalizeTotpCode(input).length === TOTP_DIGITS;
}

// ── Secret + URI de înrolare ──
// 20 de octeți = 160 de biți, dimensiunea recomandată de RFC 4226 §4 pentru cheia HMAC-SHA1.
export function generateTotpSecretBase32(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

// Eticheta din authenticator: `DETALIA Admin:email`. Emailul e identitatea de admin (nu există conturi).
export function buildTotp(email: string, secretBase32: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: email,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

// `otpauth://totp/...` — conținutul codului QR scanat de authenticator.
export function totpEnrollmentUri(email: string, secretBase32: string): string {
  return buildTotp(email, secretBase32).toString();
}

// ── Verificare + anti-replay ──
export type TotpVerification =
  | { ok: true; counter: number }
  | { ok: false; reason: "format" | "invalid" | "replay" };

// Un cod e acceptat DOAR dacă (a) e valid criptografic în fereastra de toleranță ȘI (b) pasul lui de timp
// e STRICT mai mare decât ultimul acceptat pentru acest admin.
//
// De ce (b): fără el, un cod odată văzut (peste umăr, într-un log, printr-un proxy) rămâne folosibil
// întreaga lui fereastră de valabilitate — în practică până la 90s cu window=1. Cu contorul strict
// crescător, prima folosire îl arde: a doua încercare cu ACELAȘI cod cade pe „replay". Acceptând doar
// contoare mai mari, ardem și pasul anterior (delta -1), ceea ce e intenționat — un cod deja depășit de
// timp nu are de ce să fie reluat.
export function verifyTotpCode(params: {
  secretBase32: string;
  code: string;
  lastCounter: number | null;
  timestamp?: number;
}): TotpVerification {
  const { secretBase32, code, lastCounter, timestamp } = params;
  if (!isValidTotpCodeFormat(code)) return { ok: false, reason: "format" };

  const totp = buildTotp("admin", secretBase32);
  const token = normalizeTotpCode(code);
  const delta = totp.validate({ token, window: TOTP_WINDOW, ...(timestamp ? { timestamp } : {}) });
  if (delta === null) return { ok: false, reason: "invalid" };

  const counter = totp.counter(timestamp ? { timestamp } : undefined) + delta;
  if (lastCounter !== null && counter <= lastCounter) return { ok: false, reason: "replay" };
  return { ok: true, counter };
}
