// Service Cont — ștergerea contului (GDPR, „dreptul de a fi uitat").
//
// Politică: ANONIMIZARE (tombstone), nu hard-delete. Ștergem datele personale din DB și revocăm accesul,
// dar PĂSTRĂM conținutul (detalii, schițe, comentarii, validări) atribuit „[cont șters]" — altfel am
// distruge teancul și dezbaterile altor useri (model GitHub/StackOverflow).
//
// Neon HTTP nu are tranzacții interactive → pașii sunt secvențiali. Ordinea: întâi scrubul de PII + statusul
// DELETED (erasarea critică + blocarea accesului), apoi revocarea auth, apoi blob-urile (best-effort).

import { deleteBlobs } from "@/lib/storage";
import { clearRoleVerification } from "@/server/repos/rolesRepo";
import {
  anonymizeUserRow,
  deleteUserAuth,
  getUserMedia,
  setUserStatus as setUserStatusRow,
} from "@/server/repos/usersRepo";

export type SetUserStatusError = "NOT_FOUND";

// Suspendare/reactivare (admin) — reversibilă, spre deosebire de deleteAccount. Un cont DELETED nu poate
// fi "reactivat" pe această cale (repo-ul îl exclude explicit) — apare ca NOT_FOUND, la fel ca un id greșit.
export async function setUserStatus(
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<{ ok: true; email: string } | { ok: false; error: SetUserStatusError }> {
  const row = await setUserStatusRow(userId, status);
  if (!row) return { ok: false, error: "NOT_FOUND" };
  return { ok: true, email: row.email };
}

export async function deleteAccount(userId: string): Promise<{ ok: true }> {
  const media = await getUserMedia(userId);

  // PII din rândul user → șters; email → placeholder non-PII; status → DELETED (blocat de SEC-04).
  // SEC-005: placeholder-ul NU conține userId — un id random face imposibilă corelarea (dintr-un
  // export/backup viitor) între emailul-tombstone și conținutul rămas atribuit acestui cont.
  await anonymizeUserRow(userId, `deleted-${crypto.randomUUID()}@deleted.invalid`);
  // Dovada de rol (OAR/CUI = PII) → ștearsă; verificarea resetată.
  await clearRoleVerification(userId);
  // Sesiuni + conturi OAuth → șterse (logout imediat, fără re-login).
  await deleteUserAuth(userId);
  // Avatar + cover din Blob → șterse (best-effort, nu aruncă).
  await deleteBlobs([media?.image, media?.coverImage]);

  return { ok: true };
}
