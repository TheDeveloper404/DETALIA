// Service profil — citiri (datele pentru ProfileView) + mutații (avatar/cover/poziție/detalii).
// Toată logica de business (validare, reprocesare imagine, cleanup blob, scriere DB) stă AICI;
// Server Actions rămân subțiri (extrag input din FormData → deleagă → revalidatePath).
import { cache } from "react";

import type {
  ProfileActivityItem,
  ProfileMaterialOfferItem,
  ProfileViewData,
} from "@/components/profile-view";
import { reprocessBlobImage } from "@/lib/image-processing";
import { deleteBlobs } from "@/lib/storage";
import { normalizeWebsite } from "@/lib/url";
import { isUsersBlobUrl } from "@/lib/blob-url";
import {
  computeBadges,
  diffNewBadges,
  snapshotBadges,
  type EarnedBadge,
  type SeenBadges,
} from "@/server/domain/badges";
import { isUuid } from "@/server/domain/ids";
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";
import type { RoleSnapshot } from "@/server/domain/validation";
import {
  getContributionCounts,
  getProfileStats,
  listAuthorActivity,
  listAuthorDetails,
  listAuthorSketches,
} from "@/server/repos/profileRepo";
import { listMaterialOffersBySupplier } from "@/server/repos/materialOffersRepo";
import { getOrCreateReferralCode } from "@/server/services/referralService";
import {
  countReferrals,
  getPublicProfile,
  getUserMedia,
  getUserProfile,
  updateSeenBadges,
  updateUserCoverImage,
  updateUserCoverPosition,
  updateUserDetails,
  updateUserImage,
} from "@/server/repos/usersRepo";

const ACTIVITY_LIMIT = 20;
const DAY_MS = 86_400_000;

// Nivelul de intensitate al unei zile în heatmap (0 = gol, 4 = intens).
function levelOf(n: number): number {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 9) return 3;
  return 4;
}

// Fereastra heatmap-ului: ~53 de săptămâni, aliniată la Luni (UTC), terminată azi.
function contributionWindow(): { startMs: number; todayMs: number } {
  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekdayMon = (new Date(todayMs).getUTCDay() + 6) % 7; // Luni = 0
  const startMs = todayMs - (weekdayMon + 52 * 7) * DAY_MS;
  return { startMs, todayMs };
}

// Website sigur pentru afișare: doar http/https (nevalidat la onboarding → posibile scheme periculoase).
function safeWebsite(raw: string | null): { href: string; label: string } | null {
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return { href: url.toString(), label: url.host + (url.pathname === "/" ? "" : url.pathname) };
  } catch {
    return null;
  }
}

// „Membru din <lună an>" — vizibil pe orice profil (public), nu doar al proprietarului.
export function memberSinceOf(createdAt: Date): string {
  return createdAt.toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
}

// Doar meseria (subRole) apare în platformă — rolul principal e doar grupare internă (lista_meserii.md).
export function roleLabelOf(roleMain: string | null, subRole: string | null): string {
  if (!roleMain) return "Rol nedeclarat";
  return subRole ?? (ROLE_MAIN_LABELS[roleMain as RoleMain] ?? roleMain);
}

// Timp relativ scurt în română (profilul nu cere precizie la secundă).
function relativeTime(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "azi";
  if (days === 1) return "ieri";
  if (days < 7) return `acum ${days} zile`;
  if (days < 30) return `acum ${Math.floor(days / 7)} săpt.`;
  return date.toLocaleDateString("ro-RO");
}

const SKETCH_STATUS_VIEW: Record<
  string,
  { statusLabel: string; statusKind: "approved" | "disputed" | "open" }
> = {
  PUBLISHED: { statusLabel: "În teanc", statusKind: "approved" },
  REJECTED: { statusLabel: "Respinsă", statusKind: "disputed" },
  PENDING_ACCEPTANCE: { statusLabel: "În așteptare", statusKind: "open" },
};

// Badge-urile curente ale unui user, fără restul datelor de profil (folosit de `markBadgesSeen`, care
// n-are nevoie de activitate/detalii/schițe — doar de statisticile care intră în calculul de badge).
async function computeCurrentBadges(userId: string): Promise<EarnedBadge[]> {
  const { startMs } = contributionWindow();
  const [stats, contribCounts, referralsCount] = await Promise.all([
    getProfileStats(userId),
    getContributionCounts(userId, new Date(startMs)),
    countReferrals(userId),
  ]);
  // `contribCounts` conține DOAR zilele cu activitate (>0) — mărimea mapului = nr. de zile active.
  return computeBadges({
    published: stats.published,
    sketches: stats.sketches,
    validationsGiven: stats.validationsGiven,
    validationsReceived: stats.validationsReceived,
    activeDaysLastYear: contribCounts.size,
    referralsCount,
    combinedContribution: Math.min(stats.published, stats.sketches),
    activityVolume: stats.published + stats.sketches + stats.validationsGiven,
  });
}

// Confirmă pop-up-ul de badge nou — salvează snapshot-ul curent ca „văzut", ca să nu reapară la
// următoarea vizită. Recalculează badge-urile server-side (nu are încredere în ce trimite clientul).
export async function markBadgesSeen(userId: string): Promise<void> {
  const badges = await computeCurrentBadges(userId);
  await updateSeenBadges(userId, snapshotBadges(badges));
}

// Întoarce datele de profil + dacă vizitatorul e proprietarul (ascunde editarea pentru ceilalți).
// `null` dacă userul nu există.
// React `cache()` (2026-08-17, perf): `generateMetadata` ȘI componenta paginii `/profile/[userId]` îl
// cheamă cu ACEIAȘI userId/viewerId (primitive, deci Object.is le potrivește) — fără cache() rulau
// cele ~9 query-uri de mai jos de 2 ori pe același request (cea mai grea funcție din tot profilul).
export const getProfileView = cache(async (
  userId: string,
  viewerId: string,
): Promise<ProfileViewData | null> => {
  // SEC-11: id malformat → „not found" (nu eroare SQL pe coloana uuid). Aliniat cu restul căilor de citire.
  if (!isUuid(userId)) return null;
  const profile = await getPublicProfile(userId);
  if (!profile) return null;

  const { startMs, todayMs } = contributionWindow();

  const [stats, detailRows, sketchRows, activity, contribCounts, materialOffers, referralsCount, referralCode] =
    await Promise.all([
      getProfileStats(userId),
      listAuthorDetails(userId),
      listAuthorSketches(userId),
      listAuthorActivity(userId, ACTIVITY_LIMIT),
      getContributionCounts(userId, new Date(startMs)),
      // Istoricul ofertelor de materiale trimise — STRICT privat (2026-08-25): nici măcar interogat
      // dacă viewer-ul nu e proprietarul, nu doar ascuns în UI (apărare în adâncime).
      userId === viewerId ? listMaterialOffersBySupplier(userId) : Promise.resolve([]),
      // Badge-ul „Creștem împreună" e PUBLIC (afișat oricui vizitează profilul) — count simplu, citire.
      countReferrals(userId),
      // Codul de referral (link-ul propriu-zis) se generează LENEȘ, DOAR pe propriul profil — nu are
      // sens (și ar fi un write inutil) să generăm un cod la vizita altcuiva pe profil.
      userId === viewerId ? getOrCreateReferralCode(userId) : Promise.resolve(null),
    ]);

  // Generează zilele heatmap-ului (Luni→Duminică, UTC), fiecare cu nivelul derivat din counts.
  const contributions = [];
  let contributionsTotal = 0;
  for (let ms = startMs; ms <= todayMs; ms += DAY_MS) {
    const date = new Date(ms).toISOString().slice(0, 10);
    const count = contribCounts.get(date) ?? 0;
    contributionsTotal += count;
    contributions.push({ date, count, level: levelOf(count) });
  }

  const activeDaysLastYear = contributions.filter((c) => c.count > 0).length;
  const badges = computeBadges({
    published: stats.published,
    sketches: stats.sketches,
    validationsGiven: stats.validationsGiven,
    validationsReceived: stats.validationsReceived,
    activeDaysLastYear,
    referralsCount,
    combinedContribution: Math.min(stats.published, stats.sketches),
    activityVolume: stats.published + stats.sketches + stats.validationsGiven,
  });

  const roleLabel = roleLabelOf(profile.roleMain, profile.subRole);
  const viewerIsOwner = userId === viewerId;

  // Pop-up „ai primit un badge nou" — DOAR pe propriul profil (altfel un vizitator ar declanșa
  // celebrarea în locul proprietarului). `seenBadges` e ultimul snapshot confirmat (markBadgesSeen).
  const newlyEarnedBadges = viewerIsOwner
    ? diffNewBadges(badges, (profile.seenBadges as SeenBadges | null) ?? {})
    : [];

  // Fuzionează fluxul de activitate (validări + comentarii non-justificare + publicări), recent → vechi.
  type Stamped = { item: ProfileActivityItem; at: Date };
  const stamped: Stamped[] = [];

  for (const v of activity.vRows) {
    // Rolul afișat = snapshot-ul de la momentul votului; doar validările vechi (fără snapshot) cad
    // pe rolul curent. Altfel schimbarea rolului ar rescrie retroactiv istoricul (§11c #3).
    const snap = v.roleSnapshot as RoleSnapshot | null;
    stamped.push({
      at: v.createdAt,
      item: {
        id: `v-${v.id}`,
        kind: v.position === "APPROVE" ? "approve" : "disapprove",
        target: v.detailTitle ?? v.sketchParentTitle ?? "un detaliu",
        asRole: snap ? roleLabelOf(snap.roleMain, snap.subRole) : roleLabel,
        time: relativeTime(v.createdAt),
      },
    });
  }
  for (const c of activity.cRows) {
    // Justificările de dezaprobare sunt deja reprezentate de poziția de dezaprobare → nu le dublăm.
    if (c.isJustification) continue;
    stamped.push({
      at: c.createdAt,
      item: {
        id: `c-${c.id}`,
        kind: "comment",
        target: c.detailTitle ?? c.sketchParentTitle ?? "un detaliu",
        time: relativeTime(c.createdAt),
      },
    });
  }
  for (const d of activity.dRows) {
    stamped.push({
      at: d.createdAt,
      item: {
        id: `d-${d.id}`,
        kind: "publish",
        target: d.title,
        time: relativeTime(d.createdAt),
      },
    });
  }

  stamped.sort((a, b) => b.at.getTime() - a.at.getTime());
  const activityItems = stamped.slice(0, ACTIVITY_LIMIT).map((s) => s.item);

  return {
    viewerIsOwner,
    name: profile.name ?? "Anonim",
    image: profile.image,
    coverImage: profile.coverImage,
    coverPosition: profile.coverPosition,
    roleLabel,
    memberSince: memberSinceOf(profile.createdAt),
    location: profile.location,
    company: profile.company,
    website: safeWebsite(profile.website),
    // Contact — strict opt-in prin bifă, INDIFERENT de viewer (owner inclusiv): checkbox debifat →
    // dispare și de pe propriul profil, nu doar de la ceilalți (decizie 2026-08-17, corectează
    // comportamentul anterior unde owner-ul vedea mereu telefonul chiar cu bifa scoasă).
    phone: profile.phoneVisible ? profile.phone : null,
    email: profile.emailVisible ? profile.email : null,
    bio: profile.headline, // headline = tagline sub nume
    about: profile.about,
    verified: profile.verificationStatus === "VERIFIED",
    stats,
    badges,
    newlyEarnedBadges,
    // Repo-ul filtrează PUBLISHED (profileRepo) → imageUrl mereu setat.
    details: detailRows.map((d) => ({ ...d, imageUrl: d.imageUrl! })),
    sketches: sketchRows.map((s) => ({
      id: s.id,
      detailId: s.detailId,
      parentTitle: s.parentTitle,
      title: "Propunere de schiță",
      thumbnailUrl: s.thumbnailUrl,
      ...(SKETCH_STATUS_VIEW[s.status] ?? SKETCH_STATUS_VIEW.PENDING_ACCEPTANCE),
    })),
    activity: activityItems,
    editHref: "/profile/edit",
    contributions,
    contributionsTotal,
    // gol dacă !viewerIsOwner (nici măcar interogat — vezi Promise.all de mai sus)
    referralsCount,
    referralCode, // null dacă !viewerIsOwner (n-a fost nici generat/citit — vezi Promise.all de mai sus)
    materialOffers: materialOffers.map(
      (o): ProfileMaterialOfferItem => ({
        id: o.offerId,
        detailId: o.detailId,
        detailTitle: o.detailTitle,
        message: o.message,
        fileCount: o.fileCount,
        time: relativeTime(o.updatedAt),
      }),
    ),
  };
});

// ---- Mutații profil ----------------------------------------------------------------------------
// Limite de lungime pentru câmpurile de text (domeniu, nu UI).
const NAME_MAX = 100;
const HEADLINE_MAX = 120;
const ABOUT_MAX = 1000;
const LOCATION_MAX = 120;
const WEBSITE_MAX = 200;
const COMPANY_MAX = 120;
const PHONE_MAX = 30;

// trim + plafon; gol → null (semantica „șters" în DB).
function clip(raw: string, max: number): string | null {
  const s = raw.trim();
  return s.length === 0 ? null : s.slice(0, max);
}

export type SaveImageResult = { ok: true; url: string } | { ok: false };

// Persistă poza de profil/cover DUPĂ ce clientul a urcat fișierul direct în Blob. Acceptăm DOAR un URL
// de Blob al store-ului nostru (anti-SSRF). SEC-02: re-encodare (strip EXIF/GPS) + plafon. SEC-06: cleanup orfan.
export async function setAvatar(userId: string, url: string): Promise<SaveImageResult> {
  if (!isUsersBlobUrl(url, userId)) return { ok: false };
  const processed = await reprocessBlobImage(url, "avatars", userId);
  if (!processed.ok) return { ok: false };
  const old = (await getUserMedia(userId))?.image ?? null;
  await updateUserImage(userId, processed.url);
  if (old && old !== processed.url) await deleteBlobs([old]);
  return { ok: true, url: processed.url };
}

export async function setCover(userId: string, url: string): Promise<SaveImageResult> {
  if (!isUsersBlobUrl(url, userId)) return { ok: false };
  const processed = await reprocessBlobImage(url, "covers", userId);
  if (!processed.ok) return { ok: false };
  const old = (await getUserMedia(userId))?.coverImage ?? null;
  await updateUserCoverImage(userId, processed.url);
  if (old && old !== processed.url) await deleteBlobs([old]);
  return { ok: true, url: processed.url };
}

// Șterge poza de profil/cover: golește coloana + șterge blob-ul (best-effort). Reversibil prin re-upload.
export async function removeAvatar(userId: string): Promise<void> {
  const profile = await getUserProfile(userId);
  if (profile?.image) await deleteBlobs([profile.image]);
  await updateUserImage(userId, null);
}

export async function removeCover(userId: string): Promise<void> {
  const profile = await getUserProfile(userId);
  if (profile?.coverImage) await deleteBlobs([profile.coverImage]);
  await updateUserCoverImage(userId, null);
}

// Poziția verticală a cover-ului (0..100). Clamp pe server — frontend-ul nu e sursă de adevăr.
export async function setCoverPosition(userId: string, position: number): Promise<void> {
  const clamped = Math.round(Math.min(100, Math.max(0, Number.isFinite(position) ? position : 50)));
  await updateUserCoverPosition(userId, clamped);
}

export type UpdateDetailsResult =
  | { ok: true }
  | { ok: false; reason: "EMPTY_NAME" | "NAME_TOO_LONG" | "INVALID_WEBSITE" | "INVALID_PHONE" };

// SEC-03: telefonul ajunge direct într-un `href="tel:..."` (profile-view.tsx) — allowlist la INPUT,
// ca la website (normalizeWebsite), nu doar text liber netrecut prin nimic. Cifre, spații, +, -, (, ).
const PHONE_ALLOWED = /^[0-9 +().-]+$/;
function normalizePhone(raw: string | null): { ok: true; value: string | null } | { ok: false } {
  if (raw === null) return { ok: true, value: null };
  if (!PHONE_ALLOWED.test(raw)) return { ok: false };
  return { ok: true, value: raw };
}

// Editează câmpurile de text ale profilului (NU rolul, definitiv). Numele obligatoriu; restul opțional.
// SEC-03: website cu allowlist http/https la INPUT (nu doar la randare). Primește string-uri brute din action.
export async function updateProfileDetails(
  userId: string,
  input: {
    name: string;
    headline: string;
    about: string;
    location: string;
    website: string;
    company: string;
    phone: string;
    phoneVisible: boolean;
    emailVisible: boolean;
  },
): Promise<UpdateDetailsResult> {
  const name = input.name.trim();
  if (name.length === 0) return { ok: false, reason: "EMPTY_NAME" };
  if (name.length > NAME_MAX) return { ok: false, reason: "NAME_TOO_LONG" };

  const websiteRes = normalizeWebsite(clip(input.website, WEBSITE_MAX));
  if (!websiteRes.ok) return { ok: false, reason: "INVALID_WEBSITE" };

  const phoneRes = normalizePhone(clip(input.phone, PHONE_MAX));
  if (!phoneRes.ok) return { ok: false, reason: "INVALID_PHONE" };

  await updateUserDetails(userId, {
    name,
    headline: clip(input.headline, HEADLINE_MAX),
    about: clip(input.about, ABOUT_MAX),
    location: clip(input.location, LOCATION_MAX),
    website: websiteRes.value,
    company: clip(input.company, COMPANY_MAX),
    phone: phoneRes.value,
    phoneVisible: input.phoneVisible,
    emailVisible: input.emailVisible,
  });
  return { ok: true };
}
