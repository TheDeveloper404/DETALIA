// Domain Detaliu — reguli pure (fără DB, fără infra) pentru unitatea de conținut „Detaliu".
// Detaliul = «repo»: titlu (obligatoriu) + text liber opțional + 1 imagine 2D + max 3 resurse.
// Aceste reguli se aplică pe SERVER (în DetailService), niciodată doar pe frontend.

// Status detaliu. Moderare POST-publicare (publici direct, ascundem abuzurile ulterior) — fără cozi de aprobare.
// DRAFT — „Salvează ciornă" pe formular (2026-07-06): editabil doar de autor, invizibil restului
// platformei (toate query-urile publice filtrează PUBLISHED explicit), publicabil mai târziu.
export const DETAIL_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  REMOVED: "REMOVED",
} as const;
export type DetailStatus = (typeof DETAIL_STATUS)[keyof typeof DETAIL_STATUS];

// Limite de conținut (produs, nu securitate). Mărimea feed-ului e un knob de produs.
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 5000;
export const MAX_DETAIL_RESOURCES = 3;
export const DEFAULT_FEED_SIZE = 20; // feed finit, fără scroll infinit (caracter de comunitate)
// SEC-11 — plafon defensiv pe nr. de categorii bifate (Edi: „oricâte" — capul e doar anti-abuz, nu produs).
export const MAX_DETAIL_CATEGORIES = 10;
export const MAX_RESOURCE_URL_LENGTH = 2048; // URL de resursă (limită rezonabilă de browser/DB)

// Parametri tehnici — liste finale confirmate de Edi (`lista_categorii.md`). Toți opționali; fără
// valoare aleasă = neafișat (nu forțăm „General" pe zona climatică, care n-are variantă neutră).
export const CLIMATE_ZONES = ["Zona I", "Zona II", "Zona III", "Zona IV"] as const;
export const SEISMIC_AG_VALUES = [
  "General",
  "0.10g",
  "0.15g",
  "0.20g",
  "0.25g",
  "0.30g",
  "0.35g",
  "0.40g",
] as const;
export const SEISMIC_TC_VALUES = ["General", "0.7s", "1.0s", "1.6s"] as const;
export const SNOW_LOAD_VALUES = ["General", "sk 1.5", "sk 2.0", "sk 2.5"] as const;
export const WIND_LOAD_VALUES = ["General", "qb 0.4", "qb 0.5", "qb 0.6", "qb 0.7"] as const;

function isOneOf<T extends readonly string[]>(list: T, value: string): value is T[number] {
  return (list as readonly string[]).includes(value);
}

// Tipuri de resurse opționale (oglindesc enum-ul DB detail_resource_type).
export const RESOURCE_TYPES = ["IMAGE", "LINK", "TEXT", "PDF", "CAD"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type DetailResourceInput = {
  type: ResourceType;
  url?: string | null;
  body?: string | null;
};

export function isValidResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

// URL de resursă valid = parsabil ȘI cu schemă http/https (allowlist strict).
// Blochează scheme periculoase (javascript:, data:, file: etc.) înainte de persistare,
// pentru că valoarea ajunge direct în `href`.
export function isHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

// Input normalizat după validare (gata de inserare). imageUrl e null doar pt ciorne (DRAFT) — o
// ciornă poate fi salvată înainte ca userul să ajungă la upload.
export type NormalizedDetailInput = {
  title: string;
  description: string | null;
  categoryIds: string[];
  imageUrl: string | null;
  climateZone: string | null;
  seismicAg: string;
  seismicTc: string;
  snowLoad: string;
  windLoad: string;
  resources: DetailResourceInput[];
};

export type DetailValidationError =
  | "TITLE_REQUIRED"
  | "TITLE_TOO_LONG"
  | "DESCRIPTION_TOO_LONG"
  | "IMAGE_REQUIRED"
  | "CATEGORY_REQUIRED"
  | "TOO_MANY_CATEGORIES"
  | "INVALID_ZONE"
  | "TOO_MANY_RESOURCES"
  | "INVALID_RESOURCE";

export type DetailValidationResult =
  | { ok: true; value: NormalizedDetailInput }
  | { ok: false; error: DetailValidationError };

// Validează + normalizează inputul unui detaliu (server-side, sursa de adevăr).
// `strict` (implicit true) = regulile complete de PUBLICARE (imagine + cel puțin o categorie obligatorii).
// strict:false = salvare de CIORNĂ — doar titlul e obligatoriu (altfel nu are cum să apară în lista de
// ciorne); imaginea/categoriile pot lipsi, dar dacă sunt prezente tot se validează formatul/plafoanele.
export function validateDetailInput(
  input: {
    title: string;
    description?: string | null;
    categoryIds: string[];
    imageUrl: string | null;
    climateZone?: string | null;
    seismicAg?: string | null;
    seismicTc?: string | null;
    snowLoad?: string | null;
    windLoad?: string | null;
    resources?: DetailResourceInput[];
  },
  opts: { strict?: boolean } = {},
): DetailValidationResult {
  const strict = opts.strict ?? true;

  const title = input.title?.trim() ?? "";
  if (title.length === 0) return { ok: false, error: "TITLE_REQUIRED" };
  if (title.length > TITLE_MAX_LENGTH) return { ok: false, error: "TITLE_TOO_LONG" };

  const description = input.description?.trim() || null;
  if (description !== null && description.length > DESCRIPTION_MAX_LENGTH) {
    return { ok: false, error: "DESCRIPTION_TOO_LONG" };
  }

  // Categorii: „bifezi oricâte" (Edi) — cel puțin una la PUBLICARE; la ciornă, oricâte (inclusiv zero).
  const categoryIds = [...new Set((input.categoryIds ?? []).map((c) => c.trim()).filter(Boolean))];
  if (strict && categoryIds.length === 0) return { ok: false, error: "CATEGORY_REQUIRED" };
  if (categoryIds.length > MAX_DETAIL_CATEGORIES) return { ok: false, error: "TOO_MANY_CATEGORIES" };

  const imageUrlTrimmed = input.imageUrl?.trim() || "";
  if (strict && imageUrlTrimmed.length === 0) return { ok: false, error: "IMAGE_REQUIRED" };
  const imageUrl = imageUrlTrimmed.length > 0 ? imageUrlTrimmed : null;

  const rawResources = input.resources ?? [];
  if (rawResources.length > MAX_DETAIL_RESOURCES) {
    return { ok: false, error: "TOO_MANY_RESOURCES" };
  }

  const resources: DetailResourceInput[] = [];
  for (const r of rawResources) {
    if (!isValidResourceType(r.type)) return { ok: false, error: "INVALID_RESOURCE" };
    const url = r.url?.trim() || null;
    const body = r.body?.trim() || null;
    // IMAGE/LINK/PDF/CAD au nevoie de URL; TEXT are nevoie de body.
    if (r.type === "TEXT") {
      // SEC-11: body mărginit (aceeași limită ca descrierea).
      if (!body || body.length > DESCRIPTION_MAX_LENGTH) return { ok: false, error: "INVALID_RESOURCE" };
      resources.push({ type: "TEXT", url: null, body });
    } else {
      // SEC-11: URL mărginit + allowlist http/https.
      if (!url || url.length > MAX_RESOURCE_URL_LENGTH || !isHttpUrl(url)) {
        return { ok: false, error: "INVALID_RESOURCE" };
      }
      resources.push({ type: r.type, url, body: null });
    }
  }

  // Parametri tehnici: liste fixe (Edi, `lista_categorii.md`). Toți opționali — valoare goală/lipsă
  // trece necompletată (climă) sau „General" (ceilalți, care au variantă neutră în listă).
  const climateZoneRaw = input.climateZone?.trim() || null;
  if (climateZoneRaw !== null && !isOneOf(CLIMATE_ZONES, climateZoneRaw)) {
    return { ok: false, error: "INVALID_ZONE" };
  }
  const climateZone = climateZoneRaw;

  const seismicAg = input.seismicAg?.trim() || "General";
  if (!isOneOf(SEISMIC_AG_VALUES, seismicAg)) return { ok: false, error: "INVALID_ZONE" };

  const seismicTc = input.seismicTc?.trim() || "General";
  if (!isOneOf(SEISMIC_TC_VALUES, seismicTc)) return { ok: false, error: "INVALID_ZONE" };

  const snowLoad = input.snowLoad?.trim() || "General";
  if (!isOneOf(SNOW_LOAD_VALUES, snowLoad)) return { ok: false, error: "INVALID_ZONE" };

  const windLoad = input.windLoad?.trim() || "General";
  if (!isOneOf(WIND_LOAD_VALUES, windLoad)) return { ok: false, error: "INVALID_ZONE" };

  return {
    ok: true,
    value: {
      title,
      description,
      categoryIds,
      imageUrl,
      climateZone,
      seismicAg,
      seismicTc,
      snowLoad,
      windLoad,
      resources,
    },
  };
}
