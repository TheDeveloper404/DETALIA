// Domain Validare — reguli pure pentru poziția unui user pe un Detaliu SAU Schiță (polimorfic).
// Reguli NON-NEGOCIABILE (enforce pe SERVER):
//  - Aprob = 1 click. Dezaprob = justificare OBLIGATORIE (altfel respins) → devine automat un Comment.
//  - O singură poziție per user per țintă, reversibilă (constrângere unică în DB).
//  - FĂRĂ scoring/ponderare — greutatea o dă rolul, judecat de cititor.

export const TARGET_TYPES = ["DETAIL", "SKETCH"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export const VALIDATION_POSITIONS = ["APPROVE", "DISAPPROVE"] as const;
export type ValidationPosition = (typeof VALIDATION_POSITIONS)[number];

// Justificarea (dezaprobare) și comentariile împart aceeași limită.
export const COMMENT_MAX_LENGTH = 5000;

export type JustificationResult =
  | { ok: true; value: string }
  | { ok: false; error: "REQUIRED" | "TOO_LONG" };

// „Nu există dezaprobare mută" — justificarea e obligatorie și non-vidă.
export function validateJustification(text: string | null | undefined): JustificationResult {
  const value = text?.trim() ?? "";
  if (value.length === 0) return { ok: false, error: "REQUIRED" };
  if (value.length > COMMENT_MAX_LENGTH) return { ok: false, error: "TOO_LONG" };
  return { ok: true, value };
}

// Corpul unui comentariu liber are aceleași constrângeri ca justificarea (non-vid, ≤ limită).
export function validateCommentBody(text: string | null | undefined): JustificationResult {
  return validateJustification(text);
}

// Snapshot al rolului la momentul poziției (afișare istorică — stocat în validations.role_snapshot).
export type RoleSnapshot = {
  roleMain: string;
  subRole: string | null;
  verificationStatus: string;
};
