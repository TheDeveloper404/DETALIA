// Badge-uri de profil, stil StackOverflow — Bronz/Argint/Aur pe praguri fixe, calculate LIVE din
// statistici deja existente (stats + heatmap de contribuții), fără tabelă nouă în DB.
// Decizie de produs 2026-08-17 (prima versiune, praguri ajustabile ulterior).

export type BadgeTier = "bronze" | "silver" | "gold";

export type BadgeId =
  | "contributor"
  | "illustrator"
  | "validator"
  | "trusted"
  | "consistent"
  | "growth"
  | "versatile"
  | "powerhouse"
  | "founder";

export type BadgeDef = {
  id: BadgeId;
  label: string;
  description: string;
  thresholds: Record<BadgeTier, number>;
};

export const BADGE_DEFS: readonly BadgeDef[] = [
  {
    id: "contributor",
    label: "Contribuitor",
    description: "Detalii de execuție publicate",
    thresholds: { bronze: 1, silver: 10, gold: 25 },
  },
  {
    id: "illustrator",
    label: "Ilustrator",
    description: "Schițe propuse",
    thresholds: { bronze: 1, silver: 10, gold: 25 },
  },
  {
    id: "validator",
    label: "Validator",
    description: "Validări date",
    thresholds: { bronze: 5, silver: 25, gold: 75 },
  },
  {
    id: "trusted",
    label: "De încredere",
    description: "Validări primite",
    thresholds: { bronze: 5, silver: 25, gold: 75 },
  },
  {
    id: "consistent",
    label: "Constant",
    description: "Zile active în ultimul an",
    thresholds: { bronze: 30, silver: 100, gold: 250 },
  },
  // Badge SINGLE (nu tiered) — decizie de produs 2026-08-25: cele 3 praguri identice fac
  // `tierFor` să sară direct la „gold" la 10, fără trepte intermediare de arătat.
  {
    id: "growth",
    label: "Creștem împreună",
    description: "Useri aduși prin linkul de referral",
    thresholds: { bronze: 10, silver: 10, gold: 10 },
  },
  // 3 badge-uri noi (2026-08-26), toate derivate din metrici DEJA calculate pe profil — fără
  // interogare nouă în server, doar recombinări făcute de apelant (profileService).
  {
    id: "versatile",
    label: "Polivalent",
    description: "Detalii publicate ȘI schițe propuse, în paralel",
    thresholds: { bronze: 1, silver: 5, gold: 15 },
  },
  {
    id: "powerhouse",
    label: "Motor al comunității",
    description: "Volum total de activitate (publicări + schițe + validări date)",
    thresholds: { bronze: 20, silver: 75, gold: 200 },
  },
  // SINGLE, la fel ca „growth" — membru din primele zile (înainte de trecerea MVP→v1, 2026-08-07).
  {
    id: "founder",
    label: "Fondator",
    description: "Membru din primele zile ale platformei",
    thresholds: { bronze: 1, silver: 1, gold: 1 },
  },
] as const;

// Prag „Fondator" — cutoff-ul MVP→v1 (100% funcțională, primii useri reali; vezi memoria/CHANGELOG
// 2026-08-07). Apelantul (profileService) compară `createdAt < FOUNDER_CUTOFF` și trimite 0/1.
export const FOUNDER_CUTOFF = new Date("2026-08-08T00:00:00.000Z");

export type BadgeInputs = {
  published: number;
  sketches: number;
  validationsGiven: number;
  validationsReceived: number;
  activeDaysLastYear: number;
  referralsCount: number;
  // Derivate de apelant din metricile de mai sus / din `createdAt` — badges.ts rămâne pur, fără Date.
  combinedContribution: number; // min(published, sketches)
  activityVolume: number; // published + sketches + validationsGiven
  isFounder: number; // 0 sau 1 (createdAt < FOUNDER_CUTOFF)
};

const METRIC_OF: Record<BadgeId, keyof BadgeInputs> = {
  contributor: "published",
  illustrator: "sketches",
  validator: "validationsGiven",
  trusted: "validationsReceived",
  consistent: "activeDaysLastYear",
  growth: "referralsCount",
  versatile: "combinedContribution",
  powerhouse: "activityVolume",
  founder: "isFounder",
};

function tierFor(value: number, thresholds: Record<BadgeTier, number>): BadgeTier | null {
  if (value >= thresholds.gold) return "gold";
  if (value >= thresholds.silver) return "silver";
  if (value >= thresholds.bronze) return "bronze";
  return null;
}

export type EarnedBadge = {
  id: BadgeId;
  label: string;
  description: string;
  tier: BadgeTier;
};

// Doar badge-urile CÂȘTIGATE (tier != null) — fără „progres spre următorul", păstrat simplu în v1.
export function computeBadges(inputs: BadgeInputs): EarnedBadge[] {
  const earned: EarnedBadge[] = [];
  for (const def of BADGE_DEFS) {
    const value = inputs[METRIC_OF[def.id]];
    const tier = tierFor(value, def.thresholds);
    if (tier) earned.push({ id: def.id, label: def.label, description: def.description, tier });
  }
  return earned;
}

const TIER_RANK: Record<BadgeTier, number> = { bronze: 1, silver: 2, gold: 3 };

// Snapshot persistat (users.seen_badges) — ultimul tier VĂZUT per badge, la ultima vizită proprie pe profil.
export type SeenBadges = Partial<Record<BadgeId, BadgeTier>>;

// Badge-uri NOI sau URCATE de tier față de ultimul snapshot văzut — pentru pop-up-ul „ai primit un badge".
// Pur (fără I/O) — apelantul (profileService) citește/scrie snapshot-ul.
export function diffNewBadges(current: EarnedBadge[], seen: SeenBadges): EarnedBadge[] {
  return current.filter((b) => {
    const seenTier = seen[b.id];
    return !seenTier || TIER_RANK[b.tier] > TIER_RANK[seenTier];
  });
}

// Snapshot-ul curent, gata de salvat ca `seenBadges` (Record simplu id→tier).
export function snapshotBadges(current: EarnedBadge[]): SeenBadges {
  return Object.fromEntries(current.map((b) => [b.id, b.tier])) as SeenBadges;
}
