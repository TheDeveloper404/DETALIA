// Repo roluri — singurul loc cu acces Drizzle pentru tabelul `roles`.
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { roles } from "@/db/schema";
import type { RoleMain } from "@/server/domain/roles";

type VerificationStatus = (typeof roles.verificationStatus.enumValues)[number];

export async function getRoleByUserId(userId: string) {
  const [row] = await db.select().from(roles).where(eq(roles.userId, userId)).limit(1);
  return row ?? null;
}

export async function insertRole(input: {
  userId: string;
  roleMain: RoleMain;
  subRole: string | null;
}) {
  const [row] = await db
    .insert(roles)
    .values({
      userId: input.userId,
      roleMain: input.roleMain,
      subRole: input.subRole,
      // verificationStatus rămâne pe default „DECLARED" (Poarta 2 — verificarea e separată, opțională).
    })
    .returning();
  return row;
}

// Actualizează revendicarea de rol (rol principal + subrol). Opțional resetează statusul de
// verificare — folosit când userul schimbă rolul (verificarea era legată de vechea revendicare).
export async function updateRoleClaim(
  userId: string,
  fields: { roleMain: RoleMain; subRole: string | null; verificationStatus?: VerificationStatus },
) {
  await db.update(roles).set(fields).where(eq(roles.userId, userId));
}

// Cerere de verificare (Poarta 2): trece pe PENDING + stochează dovada (OAR/CUI = PII, nu se loghează).
export async function setRoleVerificationPending(userId: string, evidence: string) {
  await db
    .update(roles)
    .set({ verificationStatus: "PENDING", verificationEvidence: evidence })
    .where(eq(roles.userId, userId));
}
