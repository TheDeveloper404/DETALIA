"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { deleteAccount } from "@/server/services/accountService";
import {
  removeAvatar,
  removeCover,
  setAvatar,
  setCover,
  setCoverPosition,
  updateProfileDetails,
} from "@/server/services/profileService";
import { requestRoleVerification } from "@/server/services/roleService";

// NOTĂ: un fișier „use server" poate exporta DOAR funcții async (Next 16). Starea inițială a formularelor
// (`initialProfileState`) trăiește în `profile-forms.tsx`, nu aici. Tipul îl exportăm (tipurile se șterg).
// `url` e populat doar de acțiunile de upload (avatar/cover) → URL-ul curat (reprocesat) pe care
// clientul îl afișează după salvare. Restul acțiunilor îl lasă nedefinit.
export type ProfileFormState = { error: string | null; ok: boolean; url?: string };

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
  const res = await setAvatar(userId, url);
  if (!res.ok) return { error: "Imaginea nu a putut fi salvată.", ok: false };
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  // Întoarcem URL-ul CURAT (originalul tocmai a fost șters) → clientul afișează imaginea corectă fără refresh.
  return { error: null, ok: true, url: res.url };
}

// Idem pentru imaginea de cover (banda de sus a profilului).
export async function saveCoverUrl(url: string): Promise<ProfileFormState> {
  const userId = await requireUserId();
  const res = await setCover(userId, url);
  if (!res.ok) return { error: "Imaginea nu a putut fi salvată.", ok: false };
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true, url: res.url };
}

// Șterge poza de profil. Reversibil prin re-upload.
export async function deleteAvatar(): Promise<ProfileFormState> {
  const userId = await requireUserId();
  await removeAvatar(userId);
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

// Salvează poziția verticală a cover-ului (0..100).
export async function saveCoverPosition(position: number): Promise<ProfileFormState> {
  const userId = await requireUserId();
  await setCoverPosition(userId, position);
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

// Șterge imaginea de cover.
export async function deleteCover(): Promise<ProfileFormState> {
  const userId = await requireUserId();
  await removeCover(userId);
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

const DETAILS_ERRORS: Record<string, string> = {
  EMPTY_NAME: "Numele nu poate fi gol.",
  NAME_TOO_LONG: "Numele e prea lung (max 100).",
  INVALID_WEBSITE: "Website-ul trebuie să înceapă cu http:// sau https://.",
};

// Editează câmpurile de text ale profilului (nume, headline, about, locație, website). NU atinge rolul (definitiv).
export async function updateProfileDetailsAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const userId = await requireUserId();
  const res = await updateProfileDetails(userId, {
    name: String(formData.get("name") ?? ""),
    headline: String(formData.get("headline") ?? ""),
    about: String(formData.get("about") ?? ""),
    location: String(formData.get("location") ?? ""),
    website: String(formData.get("website") ?? ""),
  });
  if (!res.ok) return { error: DETAILS_ERRORS[res.reason] ?? "Profilul n-a putut fi salvat.", ok: false };

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
