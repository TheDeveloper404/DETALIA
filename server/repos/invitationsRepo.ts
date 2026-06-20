// Repo invitații — acces Drizzle pentru tabelul `invitations`.
// ⚠️ Token-ul e PII/secret → NU se loghează (doar metadate: email, expirare).
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { invitations } from "@/db/schema";

export async function insertInvitation(input: {
  token: string;
  email: string;
  expiresAt: Date;
  createdByAdminId: string | null;
}) {
  const [row] = await db
    .insert(invitations)
    .values({
      token: input.token,
      email: input.email,
      expiresAt: input.expiresAt,
      createdByAdminId: input.createdByAdminId,
    })
    .returning();
  return row;
}

export async function getInvitationByToken(token: string) {
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);
  return row ?? null;
}

export async function markInvitationUsed(id: string, usedAt: Date) {
  await db.update(invitations).set({ usedAt }).where(eq(invitations.id, id));
}
