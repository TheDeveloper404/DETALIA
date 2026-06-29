"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { reprocessBlobImage } from "@/lib/image-processing";
import { BLOB_URL_RE } from "@/lib/upload-limits";
import { normalizeWebsite } from "@/lib/url";
import {
  updateUserCoverImage,
  updateUserCoverPosition,
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
  INVALID_WEBSITE: "Website-ul trebuie să înceapă cu http:// sau https://.",
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
  const websiteRaw = clean(formData.get("website")) || null;

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
    (websiteRaw && websiteRaw.length > MAX_WEBSITE)
  ) {
    return { error: ERROR_MESSAGES.FIELD_TOO_LONG };
  }

  // SEC-03: allowlist http/https pe website (nu doar la randare). Schemă nepermisă → respinge.
  const websiteRes = normalizeWebsite(websiteRaw);
  if (!websiteRes.ok) return { error: ERROR_MESSAGES.INVALID_WEBSITE };
  const website = websiteRes.value;

  // ── Imagini (opționale) — urcate CLIENT direct în Blob; aici primim doar URL-urile ────
  // Acceptăm DOAR URL-uri de Blob ale store-ului nostru (tipul/mărimea impuse la emiterea tokenului).
  const avatarUrl = clean(formData.get("avatarUrl"));
  const coverUrl = clean(formData.get("coverUrl"));
  if (avatarUrl && !BLOB_URL_RE.test(avatarUrl)) {
    return { error: ERROR_MESSAGES.INVALID_TYPE };
  }
  if (coverUrl && !BLOB_URL_RE.test(coverUrl)) {
    return { error: ERROR_MESSAGES.INVALID_TYPE };
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

  // ── URL-urile imaginilor (opționale, deja în Blob) ────
  // SEC-02: validează + re-encodează (strip metadata) + plafonează; salvăm DOAR URL-ul curat. Eșec → respinge.
  if (avatarUrl) {
    const p = await reprocessBlobImage(avatarUrl, "avatars");
    if (!p.ok) return { error: ERROR_MESSAGES.INVALID_TYPE };
    await updateUserImage(userId, p.url);
  }
  if (coverUrl) {
    const p = await reprocessBlobImage(coverUrl, "covers");
    if (!p.ok) return { error: ERROR_MESSAGES.INVALID_TYPE };
    await updateUserCoverImage(userId, p.url);
    // Poziția verticală a cover-ului (0..100); clamp server-side (frontend nu e sursa de adevăr).
    const coverPosition = Math.min(100, Math.max(0, Math.round(Number(clean(formData.get("coverPosition"))) || 50)));
    await updateUserCoverPosition(userId, coverPosition);
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
