"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { reprocessBlobImage } from "@/lib/image-processing";
import { deleteBlobs } from "@/lib/storage";
import { BLOB_URL_RE } from "@/lib/upload-limits";
import { normalizeWebsite } from "@/lib/url";
import { deleteAccount } from "@/server/services/accountService";
import {
  getUserProfile,
  updateUserCoverImage,
  updateUserCoverPosition,
  updateUserDetails,
  updateUserImage,
} from "@/server/repos/usersRepo";
import { requestRoleVerification } from "@/server/services/roleService";

// NOTĂ: un fișier „use server" poate exporta DOAR funcții async (Next 16). Starea inițială a formularelor
// (`initialProfileState`) trăiește în `profile-forms.tsx`, nu aici. Tipul îl exportăm (tipurile se șterg).
export type ProfileFormState = { error: string | null; ok: boolean };

const VERIFICATION_ERRORS: Record<string, string> = {
  NO_ROLE: "Nu ai încă un rol declarat.",
  ALREADY_VERIFIED: "Rolul tău e deja verificat.",
  PENDING: "Ai deja o cerere de verificare în curs.",
  EMPTY_EVIDENCE: "Adaugă o dovadă (nr. OAR, CUI etc.).",
};

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user.id;
}

// Persistă URL-ul pozei de profil DUPĂ ce clientul a urcat fișierul direct în Blob (vezi
// app/api/blob/upload/route.ts). Acceptăm DOAR un URL de Blob al store-ului nostru (nu URL-uri
// arbitrare în DB). Tipul/mărimea au fost deja impuse la emiterea tokenului, pe server.
export async function saveAvatarUrl(url: string): Promise<ProfileFormState> {
  const userId = await requireUserId();
  if (!BLOB_URL_RE.test(url)) {
    return { error: "Imaginea nu a putut fi salvată.", ok: false };
  }
  // SEC-02: validează + re-encodează (strip EXIF/GPS) + plafonează. URL curat în DB.
  const processed = await reprocessBlobImage(url, "avatars");
  if (!processed.ok) return { error: "Imaginea nu a putut fi salvată.", ok: false };
  await updateUserImage(userId, processed.url);
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

// Idem pentru imaginea de cover (banda de sus a profilului).
export async function saveCoverUrl(url: string): Promise<ProfileFormState> {
  const userId = await requireUserId();
  if (!BLOB_URL_RE.test(url)) {
    return { error: "Imaginea nu a putut fi salvată.", ok: false };
  }
  const processed = await reprocessBlobImage(url, "covers");
  if (!processed.ok) return { error: "Imaginea nu a putut fi salvată.", ok: false };
  await updateUserCoverImage(userId, processed.url);
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

// Șterge poza de profil: golește coloana + șterge blob-ul (best-effort). Reversibil prin re-upload.
export async function deleteAvatar(): Promise<ProfileFormState> {
  const userId = await requireUserId();
  const profile = await getUserProfile(userId);
  if (profile?.image) await deleteBlobs([profile.image]);
  await updateUserImage(userId, null);
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

// Salvează poziția verticală a cover-ului (0..100). Clamp pe server (frontend-ul nu e sursă de adevăr).
export async function saveCoverPosition(position: number): Promise<ProfileFormState> {
  const userId = await requireUserId();
  const clamped = Math.round(Math.min(100, Math.max(0, Number.isFinite(position) ? position : 50)));
  await updateUserCoverPosition(userId, clamped);
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

// Șterge imaginea de cover.
export async function deleteCover(): Promise<ProfileFormState> {
  const userId = await requireUserId();
  const profile = await getUserProfile(userId);
  if (profile?.coverImage) await deleteBlobs([profile.coverImage]);
  await updateUserCoverImage(userId, null);
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

// Editează câmpurile de text ale profilului (nume, headline, about, locație, website). NU atinge rolul (definitiv).
// Numele e obligatoriu; restul opțional (gol → null). Website fără schemă → prefixăm https://.
export async function updateProfileDetailsAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const userId = await requireUserId();

  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) return { error: "Numele nu poate fi gol.", ok: false };
  if (name.length > 100) return { error: "Numele e prea lung (max 100).", ok: false };

  const clip = (v: FormDataEntryValue | null, max: number) => {
    const s = String(v ?? "").trim();
    return s.length === 0 ? null : s.slice(0, max);
  };
  const headline = clip(formData.get("headline"), 120);
  const about = clip(formData.get("about"), 1000);
  const location = clip(formData.get("location"), 120);
  // SEC-03: allowlist http/https la input (nu doar la randare). Schemă nepermisă → respinge.
  const websiteRes = normalizeWebsite(clip(formData.get("website"), 200));
  if (!websiteRes.ok) return { error: "Website-ul trebuie să înceapă cu http:// sau https://.", ok: false };
  const website = websiteRes.value;

  await updateUserDetails(userId, { name, headline, about, location, website });

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

// Trimite o cerere de verificare a rolului (Poarta 2). Dovada (OAR/CUI) = PII, nu se loghează.
export async function requestVerificationAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const userId = await requireUserId();

  const evidence = String(formData.get("evidence") ?? "");
  const result = await requestRoleVerification({ userId, evidence });
  if (!result.ok) {
    return {
      error: VERIFICATION_ERRORS[result.error] ?? "Cererea n-a putut fi trimisă.",
      ok: false,
    };
  }

  revalidatePath("/profile");
  return { error: null, ok: true };
}

// Sign out → înapoi la landing.
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

// Ștergere cont (GDPR) — anonimizează contul (șterge PII, păstrează conținutul) + revocă accesul, apoi logout.
// Ireversibilă. userId vine din sesiune (anti-IDOR).
export async function deleteAccountAction(): Promise<void> {
  const userId = await requireUserId();
  await deleteAccount(userId);
  await signOut({ redirectTo: "/" });
}
