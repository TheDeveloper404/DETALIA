// Domain Detaliu — reguli pure (fără DB, fără infra) pentru unitatea de conținut „Detaliu".
// Detaliul = «repo»: titlu (obligatoriu) + text liber opțional + 1 imagine 2D + max 3 resurse.
// Aceste reguli se aplică pe SERVER (în DetailService), niciodată doar pe frontend.

// Status detaliu. Moderare POST-publicare (publici direct, ascundem abuzurile ulterior) — fără cozi de aprobare.
export const DETAIL_STATUS = {
  PUBLISHED: "PUBLISHED",
  REMOVED: "REMOVED",
} as const;
export type DetailStatus = (typeof DETAIL_STATUS)[keyof typeof DETAIL_STATUS];

// Limite de conținut (produs, nu securitate). Mărimea feed-ului e un knob de produs.
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 5000;
export const MAX_DETAIL_RESOURCES = 3;
export const DEFAULT_FEED_SIZE = 20; // feed finit, fără scroll infinit (caracter de comunitate)

// Tipuri de resurse opționale (oglindesc enum-ul DB detail_resource_type).
export const RESOURCE_TYPES = ["IMAGE", "LINK", "TEXT", "PDF"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type DetailResourceInput = {
  type: ResourceType;
  url?: string | null;
  body?: string | null;
};

export function isValidResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

// Input normalizat după validare (gata de inserare).
export type NormalizedDetailInput = {
  title: string;
  description: string | null;
  categoryId: string;
  imageUrl: string;
  climateZone: string;
  seismicZone: string;
  resources: DetailResourceInput[];
};

export type DetailValidationError =
  | "TITLE_REQUIRED"
  | "TITLE_TOO_LONG"
  | "DESCRIPTION_TOO_LONG"
  | "IMAGE_REQUIRED"
  | "CATEGORY_REQUIRED"
  | "TOO_MANY_RESOURCES"
  | "INVALID_RESOURCE";

export type DetailValidationResult =
  | { ok: true; value: NormalizedDetailInput }
  | { ok: false; error: DetailValidationError };

// Validează + normalizează inputul de creare a unui detaliu (server-side, sursa de adevăr).
export function validateDetailInput(input: {
  title: string;
  description?: string | null;
  categoryId: string;
  imageUrl: string;
  climateZone?: string | null;
  seismicZone?: string | null;
  resources?: DetailResourceInput[];
}): DetailValidationResult {
  const title = input.title?.trim() ?? "";
  if (title.length === 0) return { ok: false, error: "TITLE_REQUIRED" };
  if (title.length > TITLE_MAX_LENGTH) return { ok: false, error: "TITLE_TOO_LONG" };

  const description = input.description?.trim() || null;
  if (description !== null && description.length > DESCRIPTION_MAX_LENGTH) {
    return { ok: false, error: "DESCRIPTION_TOO_LONG" };
  }

  const categoryId = input.categoryId?.trim() ?? "";
  if (categoryId.length === 0) return { ok: false, error: "CATEGORY_REQUIRED" };

  const imageUrl = input.imageUrl?.trim() ?? "";
  if (imageUrl.length === 0) return { ok: false, error: "IMAGE_REQUIRED" };

  const rawResources = input.resources ?? [];
  if (rawResources.length > MAX_DETAIL_RESOURCES) {
    return { ok: false, error: "TOO_MANY_RESOURCES" };
  }

  const resources: DetailResourceInput[] = [];
  for (const r of rawResources) {
    if (!isValidResourceType(r.type)) return { ok: false, error: "INVALID_RESOURCE" };
    const url = r.url?.trim() || null;
    const body = r.body?.trim() || null;
    // IMAGE/LINK/PDF au nevoie de URL; TEXT are nevoie de body.
    if (r.type === "TEXT") {
      if (!body) return { ok: false, error: "INVALID_RESOURCE" };
      resources.push({ type: "TEXT", url: null, body });
    } else {
      if (!url) return { ok: false, error: "INVALID_RESOURCE" };
      resources.push({ type: r.type, url, body: null });
    }
  }

  // Zone climatice/seismice: listă fixă pe HOLD → acceptăm string liber cu default „General".
  const climateZone = input.climateZone?.trim() || "General";
  const seismicZone = input.seismicZone?.trim() || "General";

  return {
    ok: true,
    value: { title, description, categoryId, imageUrl, climateZone, seismicZone, resources },
  };
}
