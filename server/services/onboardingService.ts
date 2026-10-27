// Service onboarding — profil + rol salvate atomic in DB; imaginile optionale se pregatesc inainte.
// Server Action-ul (app/onboarding/actions.ts) rămâne subțire: extrage
// FormData → deleagă AICI → mapează eroarea la mesaj de UI → redirect.
import { isUsersBlobUrl } from "@/lib/blob-url";
import { reprocessBlobImage } from "@/lib/image-processing";
import { deleteBlobs } from "@/lib/storage";
import { completeOnboardingProfileAndRole } from "@/server/repos/usersRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import { validateRoleDeclaration, type RoleDeclarationError } from "@/server/domain/roles";

type CompleteOnboardingError =
  | "INVALID_TYPE"
  | "ALREADY_HAS_ROLE"
  | RoleDeclarationError;

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
  if (avatarUrl && !isUsersBlobUrl(avatarUrl, userId)) return { ok: false, error: "INVALID_TYPE" };
  if (coverUrl && !isUsersBlobUrl(coverUrl, userId)) return { ok: false, error: "INVALID_TYPE" };

  const role = validateRoleDeclaration(input);
  if (!role.ok) return role;
  if (await getRoleByUserId(userId)) return { ok: false, error: "ALREADY_HAS_ROLE" };

  // ── Imagini (opționale) — re-encodare (strip metadata) + plafonare; salvăm DOAR URL-ul curat.
  // Avatar + cover se procesează ÎN PARALEL (fiecare = fetch+sharp+reupload+delete, secvențial ar
  // dubla latența la onboarding, unde de regulă ambele sunt setate deodată).
  const [avatarResult, coverResult] = await Promise.all([
    avatarUrl ? reprocessBlobImage(avatarUrl, "avatars", userId) : null,
    coverUrl ? reprocessBlobImage(coverUrl, "covers", userId) : null,
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
  // Rolul ramane markerul de onboarding complet: commit atomic cu profilul si imaginile procesate.
  const completed = await completeOnboardingProfileAndRole(userId, {
    firstName: input.firstName,
    lastName: input.lastName,
    name: `${input.firstName} ${input.lastName}`,
    headline: input.headline,
    location: input.location,
    website: input.website,
    company: input.company,
    ...role.value,
    image: avatarResult?.ok ? avatarResult.url : undefined,
    coverImage: coverResult?.ok ? coverResult.url : undefined,
    coverPosition: input.coverPosition,
  });
  if (!completed) {
    await deleteBlobs([avatarResult?.ok ? avatarResult.url : null, coverResult?.ok ? coverResult.url : null]);
    return { ok: false, error: "ALREADY_HAS_ROLE" };
  }

  return { ok: true };
}
