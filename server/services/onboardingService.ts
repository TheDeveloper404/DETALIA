// Service onboarding — profil text + imagini (opționale) + declarare rol, într-un singur pas atomic
// din perspectiva apelantului. Server Action-ul (app/onboarding/actions.ts) rămâne subțire: extrage
// FormData → deleagă AICI → mapează eroarea la mesaj de UI → redirect.
import { isOwnBlobUrl } from "@/lib/blob-url";
import { reprocessBlobImage } from "@/lib/image-processing";
import { deleteBlobs } from "@/lib/storage";
import {
  updateUserCoverImage,
  updateUserCoverPosition,
  updateUserImage,
  updateUserProfile,
} from "@/server/repos/usersRepo";
import { declareRole, type DeclareRoleResult } from "@/server/services/roleService";

export type CompleteOnboardingError =
  | "INVALID_TYPE"
  | Extract<DeclareRoleResult, { ok: false }>["error"];

export type CompleteOnboardingResult = { ok: true } | { ok: false; error: CompleteOnboardingError };

export async function completeOnboarding(input: {
  userId: string;
  firstName: string;
  lastName: string;
  roleMain: string;
  subRole: string | null;
  secondaryRole: string | null;
  headline: string | null;
  location: string | null;
  company: string | null;
  website: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  coverPosition: number;
}): Promise<CompleteOnboardingResult> {
  const { userId, avatarUrl, coverUrl } = input;

  // SEC-02: acceptăm DOAR URL-uri de Blob ale store-ului nostru (tipul/mărimea impuse la emiterea
  // tokenului de upload). Un URL extern ar bypassa reprocesarea (anti-SSRF) de mai jos.
  if (avatarUrl && !isOwnBlobUrl(avatarUrl)) return { ok: false, error: "INVALID_TYPE" };
  if (coverUrl && !isOwnBlobUrl(coverUrl)) return { ok: false, error: "INVALID_TYPE" };

  // ── Profil text PRIMUL ────
  await updateUserProfile(userId, {
    firstName: input.firstName,
    lastName: input.lastName,
    name: `${input.firstName} ${input.lastName}`,
    headline: input.headline,
    location: input.location,
    website: input.website,
    company: input.company,
  });

  // ── Imagini (opționale) — re-encodare (strip metadata) + plafonare; salvăm DOAR URL-ul curat.
  // Avatar + cover se procesează ÎN PARALEL (fiecare = fetch+sharp+reupload+delete, secvențial ar
  // dubla latența la onboarding, unde de regulă ambele sunt setate deodată).
  const [avatarResult, coverResult] = await Promise.all([
    avatarUrl ? reprocessBlobImage(avatarUrl, "avatars") : null,
    coverUrl ? reprocessBlobImage(coverUrl, "covers") : null,
  ]);
  // Eșec parțial (una din cele două reușește, cealaltă nu) → blob-ul deja reprocesat/urcat cu succes
  // ar rămâne orfan (urcat, dar niciodată referit în DB) dacă doar am respinge fără cleanup.
  if (avatarResult && !avatarResult.ok) {
    if (coverResult?.ok) await deleteBlobs([coverResult.url]);
    return { ok: false, error: "INVALID_TYPE" };
  }
  if (coverResult && !coverResult.ok) {
    if (avatarResult?.ok) await deleteBlobs([avatarResult.url]);
    return { ok: false, error: "INVALID_TYPE" };
  }
  if (avatarResult?.ok) {
    await updateUserImage(userId, avatarResult.url);
  }
  if (coverResult?.ok) {
    await updateUserCoverImage(userId, coverResult.url);
    await updateUserCoverPosition(userId, input.coverPosition);
  }

  // ── Declară rolul ULTIMUL — e markerul de „onboarding complet" (page.tsx redirectează când există
  // rol). Dacă orice scriere de mai sus eșuează, rolul NU se creează → următoarea accesare reia
  // onboardingul, nu lasă un profil parțial permanent (rol fără nume).
  const roleResult = await declareRole({
    userId,
    roleMain: input.roleMain,
    subRole: input.subRole,
    secondaryRole: input.secondaryRole,
  });
  if (!roleResult.ok) return { ok: false, error: roleResult.error };

  return { ok: true };
}
