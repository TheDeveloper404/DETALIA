"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { uploadAvatarImage, uploadCoverImage, validateImageFile } from "@/lib/storage";
import {
  updateUserCoverImage,
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

const IMAGE_ERRORS: Record<string, string> = {
  EMPTY: "Alege o poză.",
  INVALID_TYPE: "Poza trebuie să fie PNG, JPG, WebP sau AVIF.",
  TOO_LARGE: "Poza e prea mare (max 8 MB).",
  UPLOAD_FAILED: "Stocarea imaginilor nu e disponibilă acum (config Blob).",
};

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user.id;
}

// Schimbă poza de profil. Validăm tipul/dimensiunea pe server înainte de upload.
export async function updateAvatarAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const userId = await requireUserId();

  const imageFile = formData.get("image");
  if (!(imageFile instanceof File) || imageFile.size === 0) {
    return { error: IMAGE_ERRORS.EMPTY, ok: false };
  }
  const valid = validateImageFile(imageFile);
  if (!valid.ok) {
    return { error: IMAGE_ERRORS[valid.error] ?? "Poza nu a putut fi încărcată.", ok: false };
  }

  const upload = await uploadAvatarImage(imageFile);
  if (!upload.ok) {
    return { error: IMAGE_ERRORS[upload.error] ?? "Poza nu a putut fi încărcată.", ok: false };
  }
  await updateUserImage(userId, upload.url);

  revalidatePath("/profile");
  return { error: null, ok: true };
}

// Schimbă imaginea de cover (banda de sus a profilului). Validare tip/dimensiune pe server.
export async function updateCoverAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const userId = await requireUserId();

  const imageFile = formData.get("cover");
  if (!(imageFile instanceof File) || imageFile.size === 0) {
    return { error: IMAGE_ERRORS.EMPTY, ok: false };
  }
  const valid = validateImageFile(imageFile);
  if (!valid.ok) {
    return { error: IMAGE_ERRORS[valid.error] ?? "Imaginea nu a putut fi încărcată.", ok: false };
  }

  const upload = await uploadCoverImage(imageFile);
  if (!upload.ok) {
    return { error: IMAGE_ERRORS[upload.error] ?? "Imaginea nu a putut fi încărcată.", ok: false };
  }
  await updateUserCoverImage(userId, upload.url);

  revalidatePath("/profile");
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
  let website = clip(formData.get("website"), 200);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;

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
