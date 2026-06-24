// Service Detaliu — business logic pentru crearea și citirea detaliilor.
// Reguli NON-NEGOCIABILE (enforce pe SERVER, nu pe frontend):
//  - Creare = ORICE user autentificat cu ROL DECLARAT (nu doar admin/seed, nu trebuie verificat).
//  - Titlul e obligatoriu; imaginea e obligatorie; max 3 resurse; categoria trebuie să existe.
//  - Moderare POST-publicare: detaliul intră direct PUBLISHED (fără coadă de aprobare).
//
// Upload-ul imaginii (Blob) NU stă aici: service-ul primește `imageUrl` deja rezolvat de stratul
// de infra (route handler / server action). Așa rămâne business-ul testabil și fără dependențe de infra.

import {
  DEFAULT_FEED_SIZE,
  type DetailResourceInput,
  type DetailValidationError,
  validateDetailInput,
} from "@/server/domain/detail";
import { getCategoryById } from "@/server/repos/categoriesRepo";
import {
  getDetailById,
  getDetailResources,
  insertDetail,
  insertDetailResources,
  listFeed,
} from "@/server/repos/detailsRepo";
import { listTopAuthors } from "@/server/repos/usersRepo";
import { userHasRole } from "@/server/services/roleService";

// Validare format UUID — un id malformat trebuie să dea „not found", nu o eroare SQL (500).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreateDetailError = DetailValidationError | "NO_ROLE" | "INVALID_CATEGORY";

export type CreateDetailResult =
  | { ok: true; detailId: string }
  | { ok: false; error: CreateDetailError };

export async function createDetail(input: {
  authorId: string;
  title: string;
  description?: string | null;
  categoryId: string;
  imageUrl: string;
  climateZone?: string | null;
  seismicZone?: string | null;
  resources?: DetailResourceInput[];
}): Promise<CreateDetailResult> {
  // 1) Poarta de business: doar useri cu rol declarat pot publica detalii.
  if (!(await userHasRole(input.authorId))) {
    return { ok: false, error: "NO_ROLE" };
  }

  // 2) Validare + normalizare input (titlu/imagine/resurse/zone).
  const validation = validateDetailInput({
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    imageUrl: input.imageUrl,
    climateZone: input.climateZone,
    seismicZone: input.seismicZone,
    resources: input.resources,
  });
  if (!validation.ok) return { ok: false, error: validation.error };
  const value = validation.value;

  // 3) Integritate FK polimorfică verificată în service (categoria trebuie să existe).
  const category = await getCategoryById(value.categoryId);
  if (!category) return { ok: false, error: "INVALID_CATEGORY" };

  // 4) Inserare detaliu + resurse. Driverul Neon HTTP nu oferă tranzacții interactive;
  //    inserăm secvențial — la MVP, o resursă orfană e tolerabilă (resursele sunt opționale).
  const detail = await insertDetail({
    title: value.title,
    description: value.description,
    authorId: input.authorId,
    categoryId: value.categoryId,
    imageUrl: value.imageUrl,
    climateZone: value.climateZone,
    seismicZone: value.seismicZone,
  });

  if (value.resources.length > 0) {
    await insertDetailResources(detail.id, value.resources);
  }

  return { ok: true, detailId: detail.id };
}

// Citire pagină de detaliu (doar PUBLISHED) + resursele atașate. null dacă nu există / id invalid.
export async function getDetail(id: string) {
  if (!UUID_RE.test(id)) return null;
  const detail = await getDetailById(id);
  if (!detail) return null;
  const resources = await getDetailResources(id);
  return { ...detail, resources };
}

export type FeedSort = "debated" | "recent";

// Feed finit (~20), opțional filtrat pe categorie, sortabil. Fără scroll infinit.
export async function getFeed(options?: {
  categoryId?: string | null;
  limit?: number;
  sort?: FeedSort;
}) {
  const limit = options?.limit ?? DEFAULT_FEED_SIZE;
  return listFeed({
    categoryId: options?.categoryId ?? null,
    limit,
    sort: options?.sort ?? "debated",
  });
}

// Autori activi pentru rail-ul din feed (top după detalii publicate).
export function getActiveAuthors(limit = 5) {
  return listTopAuthors(limit);
}
