"use server";

import { redirect } from "next/navigation";

import { getPostHogClient } from "@/lib/posthog-server";
import { requireActiveUserId } from "@/lib/require-active-user";
import { normalizeWebsite } from "@/lib/url";
import { completeOnboarding } from "@/server/services/onboardingService";

export type OnboardingState = { error: string | null };

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_HAS_ROLE: "Ai deja un rol declarat.",
  INVALID_ROLE: "Selectează un rol valid.",
  INVALID_SUBROLE: "Subrolul ales nu corespunde rolului.",
  INVALID_SECONDARY_ROLE: "Rolul adițional ales nu e valid.",
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
const MAX_COMPANY = 120;

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function onboardingAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  // SEC-04: onboarding SCRIE PII (nume, headline etc.) în rândul user ÎNAINTE de declareRole. Cu doar
  // `auth()` (JWT stale), un cont DELETED (anonimizat) sau SUSPENDED cu token încă viu (≤7 zile) putea
  // re-POSTa acest formular și rescrie PII real peste rândul anonimizat — anulând ștergerea GDPR (declareRole
  // ar fi picat cu ALREADY_HAS_ROLE, dar DUPĂ scrieri). Re-check status proaspăt din DB → DELETED/SUSPENDED = signOut.
  const userId = await requireActiveUserId();

  // ── Câmpuri text ────────────────────────────────────────────────
  const firstName = clean(formData.get("firstName"));
  const lastName = clean(formData.get("lastName"));
  const roleMain = clean(formData.get("roleMain"));
  const subRoleRaw = clean(formData.get("subRole"));
  const subRole = subRoleRaw || null;
  const secondaryRoleRaw = clean(formData.get("secondaryRole"));
  const secondaryRole = secondaryRoleRaw || null;
  const headline = clean(formData.get("headline")) || null;
  const location = clean(formData.get("location")) || null;
  const company = clean(formData.get("company")) || null;
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
    (company && company.length > MAX_COMPANY) ||
    (websiteRaw && websiteRaw.length > MAX_WEBSITE)
  ) {
    return { error: ERROR_MESSAGES.FIELD_TOO_LONG };
  }

  // SEC-03: allowlist http/https pe website (nu doar la randare). Schemă nepermisă → respinge.
  const websiteRes = normalizeWebsite(websiteRaw);
  if (!websiteRes.ok) return { error: ERROR_MESSAGES.INVALID_WEBSITE };
  const website = websiteRes.value;

  // ── Imagini (opționale) — urcate CLIENT direct în Blob; aici primim doar URL-urile.
  // Validarea (own-blob, tip, reprocesare) e enforce în completeOnboarding.
  const avatarUrl = clean(formData.get("avatarUrl"));
  const coverUrl = clean(formData.get("coverUrl"));

  // Poziția verticală a cover-ului (0..100); clamp server-side (frontend nu e sursa de adevăr).
  const coverPosition = Math.min(
    100,
    Math.max(0, Math.round(Number(clean(formData.get("coverPosition"))) || 50)),
  );

  const result = await completeOnboarding({
    userId,
    firstName,
    lastName,
    roleMain,
    subRole,
    secondaryRole,
    headline,
    location,
    company,
    website,
    avatarUrl: avatarUrl || null,
    coverUrl: coverUrl || null,
    coverPosition,
  });
  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: userId,
    event: "onboarding_completed",
    properties: { role_main: roleMain, sub_role: subRole, secondary_role: secondaryRole },
  });
  await posthog.flush();

  // Profil complet → direct în feed (frecare minimă la primul contact).
  redirect("/feed");
}
