"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth, clearSessionCookie, signOut } from "@/lib/auth";
import { getPostHogClient } from "@/lib/posthog-server";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import { deleteAccount } from "@/server/services/accountService";
import { markAnnouncementSeen } from "@/server/services/announcementService";
import { markDetailTourSeen } from "@/server/services/tourService";
import {
  markBadgesSeen,
  removeAvatar,
  removeCover,
  setAvatar,
  setCover,
  setCoverPosition,
  updateProfileDetails,
} from "@/server/services/profileService";

// NOTĂ: un fișier „use server" poate exporta DOAR funcții async (Next 16). Starea inițială a formularelor
// (`initialProfileState`) trăiește în `profile-forms.tsx`, nu aici. Tipul îl exportăm (tipurile se șterg).
// `url` e populat doar de acțiunile de upload (avatar/cover) → URL-ul curat (reprocesat) pe care
// clientul îl afișează după salvare. Restul acțiunilor îl lasă nedefinit.
export type ProfileFormState = { error: string | null; ok: boolean; url?: string };

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
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: "Prea multe salvări într-un timp scurt.", ok: false };
  }
  const res = await setAvatar(userId, url);
  if (!res.ok) return { error: "Imaginea nu a putut fi salvată.", ok: false };
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  // Întoarcem URL-ul CURAT (originalul tocmai a fost șters) → clientul afișează imaginea corectă fără refresh.
  return { error: null, ok: true, url: res.url };
}

// Idem pentru imaginea de cover (banda de sus a profilului).
export async function saveCoverUrl(url: string): Promise<ProfileFormState> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: "Prea multe salvări într-un timp scurt.", ok: false };
  }
  const res = await setCover(userId, url);
  if (!res.ok) return { error: "Imaginea nu a putut fi salvată.", ok: false };
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true, url: res.url };
}

// Șterge poza de profil. Reversibil prin re-upload.
export async function deleteAvatar(): Promise<ProfileFormState> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: "Prea multe salvări într-un timp scurt.", ok: false };
  }
  await removeAvatar(userId);
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

// Salvează poziția verticală a cover-ului (0..100).
export async function saveCoverPosition(position: number): Promise<ProfileFormState> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: "Prea multe salvări într-un timp scurt.", ok: false };
  }
  await setCoverPosition(userId, position);
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

// Șterge imaginea de cover.
export async function deleteCover(): Promise<ProfileFormState> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: "Prea multe salvări într-un timp scurt.", ok: false };
  }
  await removeCover(userId);
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

const DETAILS_ERRORS: Record<string, string> = {
  EMPTY_NAME: "Numele nu poate fi gol.",
  NAME_TOO_LONG: "Numele e prea lung (max 100).",
  INVALID_WEBSITE: "Website-ul trebuie să înceapă cu http:// sau https://.",
  INVALID_PHONE: "Telefonul poate conține doar cifre, spații și + - ( ).",
};

// Editează câmpurile de text ale profilului (nume, headline, about, locație, website). NU atinge rolul (definitiv).
export async function updateProfileDetailsAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: "Prea multe salvări într-un timp scurt.", ok: false };
  }
  const res = await updateProfileDetails(userId, {
    name: String(formData.get("name") ?? ""),
    headline: String(formData.get("headline") ?? ""),
    about: String(formData.get("about") ?? ""),
    location: String(formData.get("location") ?? ""),
    website: String(formData.get("website") ?? ""),
    company: String(formData.get("company") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    phoneVisible: formData.get("phoneVisible") === "on",
    emailVisible: formData.get("emailVisible") === "on",
  });
  if (!res.ok)
    return { error: DETAILS_ERRORS[res.reason] ?? "Profilul n-a putut fi salvat.", ok: false };

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, ok: true };
}

// Trimite o cerere de verificare a rolului (Poarta 2). Dovada (OAR/CUI) = PII, nu se loghează.
//
// PE HOLD: fluxul de verificare e dezactivat până definim o metodă sigură (vezi `VerificationSection`).
// Neutralizat la nivel de SERVER (nu doar UI): păstrăm gate-ul de auth, dar NU citim/persistăm dovada
// (evităm colectarea de PII fără retenție/review/limită). Re-activare: scoate short-circuit-ul de mai jos
// + readu formularul în `profile-forms.tsx`. Schela (`requestRoleVerification`) rămâne în service.
export async function requestVerificationAction(
  _prev: ProfileFormState,
  _formData: FormData,
): Promise<ProfileFormState> {
  await requireUserId();
  return { error: "Verificarea rolului nu este încă disponibilă.", ok: false };
}

// Delogarea REALĂ se face AICI, server-side, înainte de orice redirect — nu mai depinde de un
// `useEffect` client care poate să nu apuce să ruleze (tab închis, POST eșuat, lockdown de mentenanță
// pe `/logout`). SEC-001 (2026-08-09, security-engineer review PR #215): varianta anterioară muta toată
// ștergerea cookie-ului pe `/logout` (client, `next-auth/react`), motivată de un conflict real de
// Set-Cookie cu `proxy.ts` — dar acel conflict venea din wrapper-ul `auth()` din middleware, care
// rescria cookie-ul pe ORICE request (inclusiv prefetch). `proxy.ts` a trecut între timp pe `getToken()`
// (strict read-only, vezi comentariul din proxy.ts) — sursa conflictului a dispărut din toată aplicația,
// deci `signOut()` poate rula direct aici, în siguranță.
//
// `/logout` rămâne ca pas secundar (client), nu ca singura garanție — vezi app/logout/page.tsx.
const SIGN_OUT_REDIRECT = "/logout";

// Sign out — șterge cookie-ul de sesiune pe server (signOut() din lib/auth, care scrie Set-Cookie
// corect din răspunsul intern Auth.js), apoi trimite clientul pe /logout ca al doilea pas.
// Confirmă pop-up-ul „ai primit un badge nou" — marchează snapshot-ul curent ca văzut, ca să nu
// reapară la următoarea vizită. userId din sesiune (anti-IDOR, nu acceptă un id din client).
export async function confirmBadgesSeenAction(): Promise<void> {
  const userId = await requireActiveUserId();
  await markBadgesSeen(userId);
}

// Confirmă panoul „Ce e nou" — marchează versiunea curentă ca văzută. userId din sesiune (anti-IDOR).
export async function confirmAnnouncementSeenAction(): Promise<void> {
  const userId = await requireActiveUserId();
  await markAnnouncementSeen(userId);
}

// Confirmă turul ghidat de pe pagina de detaliu — nu se mai arată din nou. userId din sesiune (anti-IDOR).
export async function confirmDetailTourSeenAction(): Promise<void> {
  const userId = await requireActiveUserId();
  await markDetailTourSeen(userId);
}

export async function signOutAction() {
  // clearSessionCookie() în `finally`: cookie-ul trebuie șters chiar dacă signOut() (Auth.js) eșuează —
  // e operația care contează pentru securitate, nu poate depinde de succesul celeilalte.
  try {
    await signOut({ redirect: false });
  } finally {
    await clearSessionCookie();
  }
  redirect(SIGN_OUT_REDIRECT);
}

// Ștergere cont (GDPR) — anonimizează contul (șterge PII, păstrează conținutul) + revocă accesul, apoi logout.
// Ireversibilă. userId vine din sesiune (anti-IDOR). Cookie-ul se șterge server-side ÎNAINTE de redirect —
// contul e deja anonimizat în DB la acest punct, deci sesiunea NU trebuie să supraviețuiască sub nicio formă
// unui client care nu apucă să ruleze JS (vezi SEC-001 mai sus).
export async function deleteAccountAction(): Promise<void> {
  const userId = await requireUserId();
  await deleteAccount(userId);

  const posthog = getPostHogClient();
  posthog.capture({ distinctId: userId, event: "account_deleted" });
  await posthog.flush();

  try {
    await signOut({ redirect: false });
  } finally {
    await clearSessionCookie();
  }
  redirect(SIGN_OUT_REDIRECT);
}
