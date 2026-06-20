// Service roluri — business logic pentru declararea rolului la onboarding.
// Reguli (enforce pe SERVER, nu pe frontend):
//  - Un singur rol per user (garantat și de constrângerea unică din DB pe roles.user_id).
//  - Subrolul trebuie să aparțină rolului principal ales.
//  - Rolul e AUTO-DECLARAT de user la onboarding; verificarea (Poarta 2) e separată și opțională.

import {
  isValidRoleMain,
  isValidSubRole,
  type RoleMain,
} from "@/server/domain/roles";
import { getRoleByUserId, insertRole } from "@/server/repos/rolesRepo";

export type DeclareRoleResult =
  | { ok: true }
  | { ok: false; error: "ALREADY_HAS_ROLE" | "INVALID_ROLE" | "INVALID_SUBROLE" };

export async function declareRole(input: {
  userId: string;
  roleMain: string;
  subRole: string | null;
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

  // Un singur rol per user (verificare explicită + constrângere DB ca plasă de siguranță).
  const existing = await getRoleByUserId(input.userId);
  if (existing) {
    return { ok: false, error: "ALREADY_HAS_ROLE" };
  }

  await insertRole({ userId: input.userId, roleMain, subRole });
  return { ok: true };
}

export async function userHasRole(userId: string): Promise<boolean> {
  return (await getRoleByUserId(userId)) !== null;
}
