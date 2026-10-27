// Service roluri — citire si solicitare verificare. Declararea face parte din onboarding-ul atomic.
// Reguli (enforce pe SERVER, nu pe frontend):
//  - Un singur rol per user (garantat și de constrângerea unică din DB pe roles.user_id).
//  - Subrolul trebuie să aparțină rolului principal ales.
//  - Rolul e AUTO-DECLARAT de user la onboarding; verificarea (Poarta 2) e separată și opțională.

import {
  getRoleByUserId,
  setRoleVerificationPending,
} from "@/server/repos/rolesRepo";

export async function userHasRole(userId: string): Promise<boolean> {
  return (await getRoleByUserId(userId)) !== null;
}

// Rolul curent al unui user (pentru pagina de profil). null dacă n-a trecut prin onboarding.
export function getUserRole(userId: string) {
  return getRoleByUserId(userId);
}

type RequestVerificationResult =
  | { ok: true }
  | { ok: false; error: "NO_ROLE" | "ALREADY_VERIFIED" | "PENDING" | "EMPTY_EVIDENCE" };

// Cererea de verificare a rolului (Poarta 2 — „pull, nu push"). Opțională, fără blocare.
// Userul trimite o dovadă (OAR/CUI); statusul devine PENDING; aprobarea e manuală (admin).
export async function requestRoleVerification(input: {
  userId: string;
  evidence: string;
}): Promise<RequestVerificationResult> {
  const evidence = input.evidence.trim();
  if (!evidence) {
    return { ok: false, error: "EMPTY_EVIDENCE" };
  }

  const existing = await getRoleByUserId(input.userId);
  if (!existing) {
    return { ok: false, error: "NO_ROLE" };
  }
  if (existing.verificationStatus === "VERIFIED") {
    return { ok: false, error: "ALREADY_VERIFIED" };
  }
  if (existing.verificationStatus === "PENDING") {
    return { ok: false, error: "PENDING" };
  }

  await setRoleVerificationPending(input.userId, evidence);
  return { ok: true };
}
