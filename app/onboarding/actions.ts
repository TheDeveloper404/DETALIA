"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  uploadAvatarImage,
  uploadCoverImage,
  validateImageFile,
} from "@/lib/storage";
import {
  updateUserCoverImage,
  updateUserImage,
  updateUserProfile,
} from "@/server/repos/usersRepo";
import { declareRole } from "@/server/services/roleService";

export type OnboardingState = { error: string | null };

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_HAS_ROLE: "Ai deja un rol declarat.",
  INVALID_ROLE: "Selectează un rol valid.",
  INVALID_SUBROLE: "Subrolul ales nu corespunde rolului.",
  INVALID_TYPE: "Poza trebuie să fie PNG, JPG, WebP sau AVIF.",
  TOO_LARGE: "Poza e prea mare (max 8 MB).",
  MISSING_NAME: "Completează prenumele și numele.",
  NAME_TOO_LONG: "Numele e prea lung.",
  FIELD_TOO_LONG: "Unul dintre câmpuri e prea lung.",
};

// Limite server-side (sursa de adevăr — frontend-ul nu validează singur).
const MAX_NAME = 80;
const MAX_HEADLINE = 120;
const MAX_LOCATION = 80;
const MAX_WEBSITE = 200;

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function onboardingAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  // ── Câmpuri text ────────────────────────────────────────────────
  const firstName = clean(formData.get("firstName"));
  const lastName = clean(formData.get("lastName"));
  const roleMain = clean(formData.get("roleMain"));
  const subRoleRaw = clean(formData.get("subRole"));
  const subRole = subRoleRaw || null;
  const headline = clean(formData.get("headline")) || null;
  const location = clean(formData.get("location")) || null;
  const website = clean(formData.get("website")) || null;

  // Nume = minimul real (magic link nu-l capturează → fără el profilul rămâne fără nume).
  if (!firstName || !lastName) {
    return { error: ERROR_MESSAGES.MISSING_NAME };
  }
  if (firstName.length > MAX_NAME || lastName.length > MAX_NAME) {
    return { error: ERROR_MESSAGES.NAME_TOO_LONG };
  }
  if (
    (headline && headline.length > MAX_HEADLINE) ||
    (location && location.length > MAX_LOCATION) ||
    (website && website.length > MAX_WEBSITE)
  ) {
    return { error: ERROR_MESSAGES.FIELD_TOO_LONG };
  }

  // ── Imagini (opționale) — validăm tipul/dimensiunea ÎNAINTE de orice scriere ────
  const avatarFile = formData.get("avatar");
  const hasAvatar = avatarFile instanceof File && avatarFile.size > 0;
  if (hasAvatar) {
    const valid = validateImageFile(avatarFile);
    if (!valid.ok) {
      return { error: ERROR_MESSAGES[valid.error] ?? "Poza nu a putut fi încărcată." };
    }
  }
  const coverFile = formData.get("cover");
  const hasCover = coverFile instanceof File && coverFile.size > 0;
  if (hasCover) {
    const valid = validateImageFile(coverFile);
    if (!valid.ok) {
      return { error: ERROR_MESSAGES[valid.error] ?? "Imaginea nu a putut fi încărcată." };
    }
  }

  // ── Profil text PRIMUL ────
  await updateUserProfile(userId, {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    headline,
    location,
    website,
  });

  // ── Upload imagini (best-effort — opționale, se pot adăuga ulterior din profil) ────
  if (hasAvatar) {
    const upload = await uploadAvatarImage(avatarFile);
    if (upload.ok) {
      await updateUserImage(userId, upload.url);
    }
  }
  if (hasCover) {
    const upload = await uploadCoverImage(coverFile);
    if (upload.ok) {
      await updateUserCoverImage(userId, upload.url);
    }
  }

  // ── Declară rolul ULTIMUL — e markerul de „onboarding complet" (page.tsx redirectează când există rol).
  // Dacă orice scriere de mai sus eșuează, rolul NU se creează → următoarea accesare reia onboardingul,
  // nu lasă un profil parțial permanent (rol fără nume). Regulile de business trăiesc în service.
  const result = await declareRole({ userId, roleMain, subRole });
  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }

  // Profil complet → direct în feed (frecare minimă la primul contact).
  redirect("/feed");
}
