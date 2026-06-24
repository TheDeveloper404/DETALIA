// Service profil — construiește datele pentru ProfileView (header + stats + taburi), pe date REALE.
// Stats/activitate derivate din tabelele existente (vezi profileRepo). Citiri (fără mutații).
import type {
  ProfileActivityItem,
  ProfileViewData,
} from "@/components/profile-view";
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";
import {
  getContributionCounts,
  getProfileStats,
  listAuthorActivity,
  listAuthorDetails,
  listAuthorSketches,
} from "@/server/repos/profileRepo";
import { getPublicProfile } from "@/server/repos/usersRepo";

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

function roleLabelOf(roleMain: string | null, subRole: string | null): string {
  if (!roleMain) return "Rol nedeclarat";
  const main = ROLE_MAIN_LABELS[roleMain as RoleMain] ?? roleMain;
  return subRole ? `${main} · ${subRole}` : main;
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

// Întoarce datele de profil + dacă vizitatorul e proprietarul (ascunde editarea pentru ceilalți).
// `null` dacă userul nu există.
export async function getProfileView(
  userId: string,
  viewerId: string,
): Promise<ProfileViewData | null> {
  const profile = await getPublicProfile(userId);
  if (!profile) return null;

  const { startMs, todayMs } = contributionWindow();

  const [stats, detailRows, sketchRows, activity, contribCounts] = await Promise.all([
    getProfileStats(userId),
    listAuthorDetails(userId),
    listAuthorSketches(userId),
    listAuthorActivity(userId, ACTIVITY_LIMIT),
    getContributionCounts(userId, new Date(startMs)),
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

  const roleLabel = roleLabelOf(profile.roleMain, profile.subRole);

  // Fuzionează fluxul de activitate (validări + comentarii non-justificare + publicări), recent → vechi.
  type Stamped = { item: ProfileActivityItem; at: Date };
  const stamped: Stamped[] = [];

  for (const v of activity.vRows) {
    stamped.push({
      at: v.createdAt,
      item: {
        id: `v-${v.id}`,
        kind: v.position === "APPROVE" ? "approve" : "disapprove",
        target: v.detailTitle ?? v.sketchParentTitle ?? "un detaliu",
        asRole: roleLabel,
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
    viewerIsOwner: userId === viewerId,
    name: profile.name ?? "Anonim",
    image: profile.image,
    roleLabel,
    location: profile.location,
    website: safeWebsite(profile.website),
    bio: profile.headline, // headline = tagline sub nume (bio/about extinse = backlog)
    about: null,
    specializations: [],
    verified: profile.verificationStatus === "VERIFIED",
    stats,
    details: detailRows,
    sketches: sketchRows.map((s) => ({
      id: s.id,
      parentTitle: s.parentTitle,
      title: "Propunere de schiță",
      ...(SKETCH_STATUS_VIEW[s.status] ?? SKETCH_STATUS_VIEW.PENDING_ACCEPTANCE),
    })),
    activity: activityItems,
    editHref: "/profile/edit",
    contributions,
    contributionsTotal,
  };
}
