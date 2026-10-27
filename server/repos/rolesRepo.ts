// Repo roluri — citiri/verificare rol. Crearea atomica impreuna cu profilul sta in usersRepo.
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { roles } from "@/db/schema";

export async function getRoleByUserId(userId: string) {
  const [row] = await db.select().from(roles).where(eq(roles.userId, userId)).limit(1);
  return row ?? null;
}

// GDPR — la ștergerea contului: șterge dovada de rol (PII) + resetează verificarea. Rolul (main/sub) rămâne
// ca atribut non-PII al conținutului păstrat.
export async function clearRoleVerification(userId: string) {
  await db
    .update(roles)
    .set({ verificationStatus: "DECLARED", verificationEvidence: null, verifiedByAdminId: null })
    .where(eq(roles.userId, userId));
}

// Cerere de verificare (Poarta 2): trece pe PENDING + stochează dovada (OAR/CUI = PII, nu se loghează).
export async function setRoleVerificationPending(userId: string, evidence: string) {
  await db
    .update(roles)
    .set({ verificationStatus: "PENDING", verificationEvidence: evidence })
    .where(eq(roles.userId, userId));
}
