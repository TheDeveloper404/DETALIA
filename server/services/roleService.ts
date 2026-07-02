// Service roluri — business logic pentru declararea rolului la onboarding.
// Reguli (enforce pe SERVER, nu pe frontend):
//  - Un singur rol per user (garantat și de constrângerea unică din DB pe roles.user_id).
//  - Subrolul trebuie să aparțină rolului principal ales.
//  - Rolul e AUTO-DECLARAT de user la onboarding; verificarea (Poarta 2) e separată și opțională.

import {
  isValidRoleMain,
  isValidSecondaryRole,
  isValidSubRole,
  type RoleMain,
} from "@/server/domain/roles";
import {
  getRoleByUserId,
  insertRole,
  setRoleVerificationPending,
  updateRoleClaim,
} from "@/server/repos/rolesRepo";

export type DeclareRoleResult =
  | { ok: true }
  | {
      ok: false;
      error: "ALREADY_HAS_ROLE" | "INVALID_ROLE" | "INVALID_SUBROLE" | "INVALID_SECONDARY_ROLE";
    };

export async function declareRole(input: {
  userId: string;
  roleMain: string;
  subRole: string | null;
  secondaryRole?: string | null;
}): Promise<DeclareRoleResult> {
  if (!isValidRoleMain(input.roleMain)) {
    return { ok: false, error: "INVALID_ROLE" };
  }
  const roleMain: RoleMain = input.roleMain;

  // Subrolul e opțional, dar dacă e dat trebuie să aparțină rolului principal.
  const subRole = input.subRole?.trim() || null;
  if (subRole !== null && !isValidSubRole(roleMain, subRole)) {
    return { ok: false, error: "INVALID_SUBROLE" };
  }

  // Rol adițional (Administrativ/Educație) — opțional, ADITIV peste meseria de bază.
  const secondaryRole = input.secondaryRole?.trim() || null;
  if (secondaryRole !== null && !isValidSecondaryRole(secondaryRole)) {
    return { ok: false, error: "INVALID_SECONDARY_ROLE" };
  }

  // Un singur rol per user (verificare explicită + constrângere DB ca plasă de siguranță).
  const existing = await getRoleByUserId(input.userId);
  if (existing) {
    return { ok: false, error: "ALREADY_HAS_ROLE" };
  }

  await insertRole({ userId: input.userId, roleMain, subRole, secondaryRole });
  return { ok: true };
}

export async function userHasRole(userId: string): Promise<boolean> {
  return (await getRoleByUserId(userId)) !== null;
}

// Rolul curent al unui user (pentru pagina de profil). null dacă n-a trecut prin onboarding.
export function getUserRole(userId: string) {
  return getRoleByUserId(userId);
}

export type UpdateRoleResult =
  | { ok: true }
  | { ok: false; error: "NO_ROLE" | "INVALID_ROLE" | "INVALID_SUBROLE" | "INVALID_SECONDARY_ROLE" };

// Editarea rolului din profil. Reguli (enforce pe SERVER):
//  - userul trebuie să aibă deja un rol (altfel e onboarding, nu editare).
//  - subrolul trebuie să aparțină rolului principal; rolul adițional e opțional și independent.
//  - dacă revendicarea de bază (rol sau subrol) se schimbă, verificarea redevine DECLARED — badge-ul
//    de verificat aparținea vechii revendicări, nu se mută automat pe noua alegere.
export async function updateRole(input: {
  userId: string;
  roleMain: string;
  subRole: string | null;
  secondaryRole?: string | null;
}): Promise<UpdateRoleResult> {
  if (!isValidRoleMain(input.roleMain)) {
    return { ok: false, error: "INVALID_ROLE" };
  }
  const roleMain: RoleMain = input.roleMain;

  const subRole = input.subRole?.trim() || null;
  if (subRole !== null && !isValidSubRole(roleMain, subRole)) {
    return { ok: false, error: "INVALID_SUBROLE" };
  }

  const secondaryRole = input.secondaryRole?.trim() || null;
  if (secondaryRole !== null && !isValidSecondaryRole(secondaryRole)) {
    return { ok: false, error: "INVALID_SECONDARY_ROLE" };
  }

  const existing = await getRoleByUserId(input.userId);
  if (!existing) {
    return { ok: false, error: "NO_ROLE" };
  }

  const claimChanged = existing.roleMain !== roleMain || (existing.subRole ?? null) !== subRole;
  // Resetăm verificarea DOAR dacă revendicarea de bază s-a schimbat ȘI fusese deja procesată.
  const resetVerification =
    claimChanged && existing.verificationStatus !== "DECLARED";

  await updateRoleClaim(input.userId, {
    roleMain,
    subRole,
    secondaryRole,
    ...(resetVerification ? { verificationStatus: "DECLARED" as const } : {}),
  });
  return { ok: true };
}

export type RequestVerificationResult =
  | { ok: true }
  | { ok: false; error: "NO_ROLE" | "ALREADY_VERIFIED" | "PENDING" | "EMPTY_EVIDENCE" };

// Cererea de verificare a rolului (Poarta 2 — „pull, nu push"). Opțională, fără blocare.
// Userul trimite o dovadă (OAR/CUI); statusul devine PENDING; aprobarea e manuală (admin/Edi).
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
