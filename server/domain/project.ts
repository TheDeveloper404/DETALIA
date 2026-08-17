// Domain Proiect — colaborare restrânsă (2026-08-09). Reguli pure, fără DB/IO.
//
// Al treilea strat, pe lângă Detaliu (public) și Planșă (strict privată): un spațiu de colaborare
// restrânsă, tip Google Drive. Doar 2 poziții: Autor (owner) și Invitați — Invitații se comportă
// identic cu owner-ul în rest (nu există Viewer/Editor). Vezi planul complet:
// C:\dev\persist\claude\plans\proiect-colaborare-restransa.md

// ── Un detaliu stă mereu într-un SINGUR loc din trei ────────────────────────────────────────────
// Invariantă structurală, nu doar de business: combinația (status, projectId) codifică exact 3 stări
// posibile, fără suprapunere — orice altă combinație (ex. DRAFT + projectId setat) e un input invalid,
// nu o a patra stare de gestionat.
export type DetailPlacement = "DRAFT" | "PROJECT" | "COMMUNITY";

export function resolveDetailPlacement(input: {
  status: string;
  projectId: string | null;
}): DetailPlacement {
  if (input.status !== "PUBLISHED") return "DRAFT";
  return input.projectId ? "PROJECT" : "COMMUNITY";
}

// ── Numele proiectului ───────────────────────────────────────────────────────────────────────────
export const PROJECT_NAME_MAX_LENGTH = 80;
export type ProjectNameError = "EMPTY" | "TOO_LONG";

export function validateProjectName(
  input: unknown,
): { ok: true; value: string } | { ok: false; error: ProjectNameError } {
  if (typeof input !== "string") return { ok: false, error: "EMPTY" };
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, error: "EMPTY" };
  if (trimmed.length > PROJECT_NAME_MAX_LENGTH) return { ok: false, error: "TOO_LONG" };
  return { ok: true, value: trimmed };
}

// ── Tokenul de invitație ─────────────────────────────────────────────────────────────────────────
// 32 bytes (256 biți) — aceeași entropie ca tokenurile de admin (lib/admin-auth.ts), generate cu
// `randomBytes(INVITE_TOKEN_BYTES).toString("hex")`. Generarea/hash-ul propriu-zis trăiesc în
// lib/invite-token.ts (au nevoie de node:crypto — domain-ul rămâne pur, fără IO/dependințe de mediu).
export const INVITE_TOKEN_BYTES = 32;

// ── Poarta de acces la un proiect ────────────────────────────────────────────────────────────────
// SINGURUL punct de control pentru vizibilitatea privată — orice citire a unui detaliu cu
// `projectId` setat trebuie să treacă prin asta (direct sau indirect, prin serviciul care-l citește).
// Owner-ul NU are neapărat un rând în `project_members` (vezi db/schema.ts) — verificat separat aici.
export function hasProjectAccess(input: { isOwner: boolean; isActiveMember: boolean }): boolean {
  return input.isOwner || input.isActiveMember;
}

// ── Regula „orfan" (decizia #1 din documentul sursă) ────────────────────────────────────────────
// Cine poate scoate un detaliu din proiect în comunitate (mutație ireversibilă, vezi projectId=null
// în schema.ts): autorul detaliului, ORICÂND — sau, dacă autorul a părăsit/a fost eliminat din
// proiect (nu mai e membru activ), owner-ul proiectului poate scoate detaliul „orfan" în locul lui.
// Owner-ul NU poate scoate detaliul cât timp autorul e încă membru activ — nu e moderare, e decizia
// autorului asupra propriului conținut.
export function canReleaseToCommunity(input: {
  isDetailAuthor: boolean;
  isProjectOwner: boolean;
  authorIsActiveMember: boolean;
}): boolean {
  return input.isDetailAuthor || (input.isProjectOwner && !input.authorIsActiveMember);
}

// ── Marcaj de timp pe numele partajării de planșă (§6B) ─────────────────────────────────────────
// Numele partajării e o „copie înghețată" (vezi projectCanvasShares din schema.ts) — compus O SINGURĂ
// DATĂ la share, niciodată reformatat. `Date.get*()` fără `timeZone` citesc ora runtime-ului
// serverului (Vercel = UTC), nu ora Bucureștiului — cu 2-3 ore în urmă față de ce vede userul (bug
// real 2026-08-16, raportat). Fix: `Intl.DateTimeFormat` cu `timeZone: "Europe/Bucharest"`
// explicit (gestionează DST automat) + părți numerice explicite (NU stil „short"/„long" — variază cu
// ICU-ul disponibil la runtime, aceeași grijă ca la formatarea inițială, vezi git blame).
const SHARE_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Bucharest",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatShareTimestamp(date: Date): string {
  const parts = Object.fromEntries(
    SHARE_TIMESTAMP_FORMATTER.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

