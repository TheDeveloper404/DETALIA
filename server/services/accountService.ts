// Service Cont — ștergerea contului (GDPR, „dreptul de a fi uitat").
//
// Politică: ANONIMIZARE (tombstone), nu hard-delete. Ștergem datele personale din DB și revocăm accesul,
// dar PĂSTRĂM conținutul (detalii, schițe, comentarii, validări) atribuit „Utilizator șters" — altfel am
// distruge teancul și dezbaterile altor useri (model GitHub/StackOverflow).
//
// Neon HTTP nu are tranzacții interactive → pașii sunt secvențiali. Ordinea: întâi scrubul de PII + statusul
// DELETED (erasarea critică + blocarea accesului), apoi revocarea auth, apoi blob-urile (best-effort).

import { deleteBlobs } from "@/lib/storage";
import { clearRoleVerification } from "@/server/repos/rolesRepo";
import { anonymizeUserRow, deleteUserAuth, getUserMedia } from "@/server/repos/usersRepo";

export async function deleteAccount(userId: string): Promise<{ ok: true }> {
  const media = await getUserMedia(userId);

  // PII din rândul user → șters; email → placeholder non-PII; status → DELETED (blocat de SEC-04).
  await anonymizeUserRow(userId, `deleted-${userId}@deleted.invalid`);
  // Dovada de rol (OAR/CUI = PII) → ștearsă; verificarea resetată.
  await clearRoleVerification(userId);
  // Sesiuni + conturi OAuth → șterse (logout imediat, fără re-login).
  await deleteUserAuth(userId);
  // Avatar + cover din Blob → șterse (best-effort, nu aruncă).
  await deleteBlobs([media?.image, media?.coverImage]);

  return { ok: true };
}
