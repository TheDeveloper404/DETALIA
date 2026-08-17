// Badge-uri de profil, stil StackOverflow — Bronz/Argint/Aur pe praguri fixe, calculate LIVE din
// statistici deja existente (stats + heatmap de contribuții), fără tabelă nouă în DB.
// Decizie de produs 2026-08-17 (prima versiune, praguri ajustabile ulterior).

export type BadgeTier = "bronze" | "silver" | "gold";

export type BadgeId = "contributor" | "illustrator" | "validator" | "trusted" | "consistent";

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
] as const;

export type BadgeInputs = {
  published: number;
  sketches: number;
  validationsGiven: number;
  validationsReceived: number;
  activeDaysLastYear: number;
};

const METRIC_OF: Record<BadgeId, keyof BadgeInputs> = {
  contributor: "published",
  illustrator: "sketches",
  validator: "validationsGiven",
  trusted: "validationsReceived",
  consistent: "activeDaysLastYear",
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
