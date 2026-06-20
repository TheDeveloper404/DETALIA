// Service invitații — Poarta 1 (ACCESUL la beta închis).
//
// ⚠️ ÎN HOLD: scheletul există dar NU e cablat în signup/gating. Activarea (invite-only vs.
// înregistrare publică) e o decizie de produs deschisă. Nu finaliza gating-ul fără confirmare.
//
// Invitația dă DOAR acces — NU atribuie rolul (rolul e auto-declarat la onboarding).
// Token one-time, cu expirare. TTL din env (INVITATION_TTL_HOURS), niciodată hardcodat.

import { randomBytes } from "node:crypto";

import {
  getInvitationByToken,
  insertInvitation,
  markInvitationUsed,
} from "@/server/repos/invitationsRepo";

const DEFAULT_TTL_HOURS = 168; // 7 zile — fallback dacă env lipsește.

function invitationTtlMs(): number {
  const hours = Number(process.env.INVITATION_TTL_HOURS ?? DEFAULT_TTL_HOURS);
  return hours * 60 * 60 * 1000;
}

// Token criptografic, URL-safe, one-time.
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createInvitation(input: {
  email: string;
  createdByAdminId: string | null;
}) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + invitationTtlMs());
  await insertInvitation({
    token,
    email: input.email.trim().toLowerCase(),
    expiresAt,
    createdByAdminId: input.createdByAdminId,
  });
  // Întoarcem token-ul pentru ca adminul să compună link-ul de invitație (NU îl logăm).
  return { token, expiresAt };
}

export type InvitationCheck =
  | { valid: true; email: string }
  | { valid: false; reason: "NOT_FOUND" | "USED" | "EXPIRED" };

export async function validateInvitation(token: string): Promise<InvitationCheck> {
  const invitation = await getInvitationByToken(token);
  if (!invitation) return { valid: false, reason: "NOT_FOUND" };
  if (invitation.usedAt) return { valid: false, reason: "USED" };
  if (invitation.expiresAt.getTime() < Date.now()) return { valid: false, reason: "EXPIRED" };
  return { valid: true, email: invitation.email };
}

// Marchează invitația ca folosită (one-time). De apelat la consumarea efectivă, când Poarta 1 se activează.
export async function consumeInvitation(token: string): Promise<InvitationCheck> {
  const check = await validateInvitation(token);
  if (!check.valid) return check;
  const invitation = await getInvitationByToken(token);
  if (invitation) {
    await markInvitationUsed(invitation.id, new Date());
  }
  return check;
}
