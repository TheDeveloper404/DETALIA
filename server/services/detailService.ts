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
  DETAIL_STATUS,
  type DetailResourceInput,
  type DetailValidationError,
  validateDetailInput,
} from "@/server/domain/detail";
import { deleteBlobs } from "@/lib/storage";
import { countExistingCategoryIds } from "@/server/repos/categoriesRepo";
import {
  deleteDetailCascade,
  deleteSavedDetail,
  getDetailById,
  getDetailForEdit,
  getDetailResources,
  insertDetailWithRelations,
  insertSavedDetail,
  isDetailSavedByUser,
  listDetailDraftsByAuthor,
  listFeed,
  listTopDebated,
  listRelatedDetails,
  listSavedDetailIds,
  listSavedDetails,
  publishDetailRow,
  replaceDetailCategories,
  replaceDetailResources,
  updateDetailRow,
} from "@/server/repos/detailsRepo";
import { listTopAuthors } from "@/server/repos/usersRepo";
import { isUuid } from "@/server/domain/ids";
import { userHasRole } from "@/server/services/roleService";

export type CreateDetailError = DetailValidationError | "NO_ROLE" | "INVALID_CATEGORY";

export type CreateDetailResult =
  | { ok: true; detailId: string }
  | { ok: false; error: CreateDetailError };

export async function createDetail(input: {
  authorId: string;
  title: string;
  description?: string | null;
  categoryIds: string[];
  imageUrl: string;
  climateZone?: string | null;
  seismicAg?: string | null;
  seismicTc?: string | null;
  snowLoad?: string | null;
  windLoad?: string | null;
  resources?: DetailResourceInput[];
}): Promise<CreateDetailResult> {
  // 1) Poarta de business: doar useri cu rol declarat pot publica detalii.
  if (!(await userHasRole(input.authorId))) {
    return { ok: false, error: "NO_ROLE" };
  }

  // 2) Validare + normalizare input (titlu/imagine/resurse/categorii/parametri tehnici).
  const validation = validateDetailInput({
    title: input.title,
    description: input.description,
    categoryIds: input.categoryIds,
    imageUrl: input.imageUrl,
    climateZone: input.climateZone,
    seismicAg: input.seismicAg,
    seismicTc: input.seismicTc,
    snowLoad: input.snowLoad,
    windLoad: input.windLoad,
    resources: input.resources,
  });
  if (!validation.ok) return { ok: false, error: validation.error };
  const value = validation.value;

  // 3) Integritate FK verificată în service (fiecare categorie bifată trebuie să existe).
  // SEC-11: id malformat → INVALID_CATEGORY (nu eroare SQL pe coloana uuid).
  if (value.categoryIds.some((id) => !isUuid(id))) return { ok: false, error: "INVALID_CATEGORY" };
  const existingCount = await countExistingCategoryIds(value.categoryIds);
  if (existingCount !== value.categoryIds.length) return { ok: false, error: "INVALID_CATEGORY" };

  // 4) Inserare detaliu + categorii + resurse — atomic într-un singur `db.batch` (id generat client-side).
  const detail = await insertDetailWithRelations({
    title: value.title,
    description: value.description,
    authorId: input.authorId,
    imageUrl: value.imageUrl,
    climateZone: value.climateZone,
    seismicAg: value.seismicAg,
    seismicTc: value.seismicTc,
    snowLoad: value.snowLoad,
    windLoad: value.windLoad,
    categoryIds: value.categoryIds,
    resources: value.resources,
  });

  return { ok: true, detailId: detail.id };
}

export type UpdateDetailError = DetailValidationError | "NOT_FOUND" | "FORBIDDEN" | "INVALID_CATEGORY";

export type UpdateDetailResult =
  | { ok: true; oldImageUrl: string | null } // oldImageUrl != null → imaginea s-a schimbat, blob-ul vechi de curățat
  | { ok: false; error: UpdateDetailError };

// Editarea unui detaliu de către AUTORUL lui (enforce pe SERVER — ownership, nu frontend).
//  - id malformat / inexistent → NOT_FOUND (nu dezvăluim existența).
//  - alt user decât autorul → FORBIDDEN.
// Imaginea: `imageUrl` primit e deja procesat de infra (action). Dacă diferă de cea stocată,
// întoarcem URL-ul vechi ca action-ul să șteargă blob-ul orfan (best-effort).
export async function updateDetail(input: {
  detailId: string;
  userId: string;
  title: string;
  description?: string | null;
  categoryIds: string[];
  imageUrl: string;
  climateZone?: string | null;
  seismicAg?: string | null;
  seismicTc?: string | null;
  snowLoad?: string | null;
  windLoad?: string | null;
  resources?: DetailResourceInput[];
}): Promise<UpdateDetailResult> {
  if (!isUuid(input.detailId)) return { ok: false, error: "NOT_FOUND" };

  // 1) Ownership: doar autorul detaliului îl poate edita.
  const existing = await getDetailById(input.detailId);
  if (!existing) return { ok: false, error: "NOT_FOUND" };
  if (existing.authorId !== input.userId) return { ok: false, error: "FORBIDDEN" };

  // 2) Validare + normalizare (aceleași reguli ca la creare).
  const validation = validateDetailInput({
    title: input.title,
    description: input.description,
    categoryIds: input.categoryIds,
    imageUrl: input.imageUrl,
    climateZone: input.climateZone,
    seismicAg: input.seismicAg,
    seismicTc: input.seismicTc,
    snowLoad: input.snowLoad,
    windLoad: input.windLoad,
    resources: input.resources,
  });
  if (!validation.ok) return { ok: false, error: validation.error };
  const value = validation.value;

  // 3) Integritate FK categorii (id malformat → INVALID_CATEGORY, nu eroare SQL).
  if (value.categoryIds.some((id) => !isUuid(id))) return { ok: false, error: "INVALID_CATEGORY" };
  const existingCount = await countExistingCategoryIds(value.categoryIds);
  if (existingCount !== value.categoryIds.length) return { ok: false, error: "INVALID_CATEGORY" };

  // 4) Update detaliu + înlocuire categorii + resurse.
  await updateDetailRow(input.detailId, {
    title: value.title,
    description: value.description,
    imageUrl: value.imageUrl,
    climateZone: value.climateZone,
    seismicAg: value.seismicAg,
    seismicTc: value.seismicTc,
    snowLoad: value.snowLoad,
    windLoad: value.windLoad,
  });
  await replaceDetailCategories(input.detailId, value.categoryIds);

  // Resursele TEXT nu au câmp în formularul de editare (doar IMAGE/LINK/PDF) → le păstrăm explicit,
  // altfel delete-all + insert le-ar șterge silențios. Le combinăm cu cele venite din formular.
  const existingResources = await getDetailResources(input.detailId);
  const preservedText: DetailResourceInput[] = existingResources
    .filter((r) => r.type === "TEXT")
    .map((r) => ({ type: "TEXT", body: r.body }));
  await replaceDetailResources(input.detailId, [...preservedText, ...value.resources]);

  const imageChanged = existing.imageUrl !== value.imageUrl;
  return { ok: true, oldImageUrl: imageChanged ? existing.imageUrl : null };
}

export type DraftDetailInput = {
  title: string;
  description?: string | null;
  categoryIds?: string[];
  imageUrl?: string | null;
  climateZone?: string | null;
  seismicAg?: string | null;
  seismicTc?: string | null;
  snowLoad?: string | null;
  windLoad?: string | null;
  resources?: DetailResourceInput[];
};

export type DraftDetailError = DetailValidationError | "NO_ROLE" | "INVALID_CATEGORY" | "NOT_FOUND";

export type SaveDraftDetailResult =
  | { ok: true; detailId: string; oldImageUrl: string | null }
  | { ok: false; error: DraftDetailError };

// „Salvează ciornă" — validare LENIENTĂ (strict:false, doar titlul obligatoriu). Publicarea completă
// (imagine + categorie obligatorii) se verifică abia la `publishDetailDraft`, nu aici.
async function validateDraft(input: DraftDetailInput) {
  return validateDetailInput(
    {
      title: input.title,
      description: input.description,
      categoryIds: input.categoryIds ?? [],
      imageUrl: input.imageUrl ?? null,
      climateZone: input.climateZone,
      seismicAg: input.seismicAg,
      seismicTc: input.seismicTc,
      snowLoad: input.snowLoad,
      windLoad: input.windLoad,
      resources: input.resources,
    },
    { strict: false },
  );
}

// Creează o CIORNĂ de detaliu (status DRAFT) — pornit de pe /details/new, prima dată când userul
// apasă „Salvează ciornă" (nu mai există un id încă). Aceleași porți de business ca `createDetail`
// (rol declarat), dar fără regulile stricte de publicare.
export async function createDetailDraft(
  input: DraftDetailInput & { authorId: string },
): Promise<SaveDraftDetailResult> {
  if (!(await userHasRole(input.authorId))) return { ok: false, error: "NO_ROLE" };

  const validation = await validateDraft(input);
  if (!validation.ok) return { ok: false, error: validation.error };
  const value = validation.value;

  if (value.categoryIds.some((id) => !isUuid(id))) return { ok: false, error: "INVALID_CATEGORY" };
  const existingCount = await countExistingCategoryIds(value.categoryIds);
  if (existingCount !== value.categoryIds.length) return { ok: false, error: "INVALID_CATEGORY" };

  const detail = await insertDetailWithRelations({
    title: value.title,
    description: value.description,
    authorId: input.authorId,
    imageUrl: value.imageUrl,
    climateZone: value.climateZone,
    seismicAg: value.seismicAg,
    seismicTc: value.seismicTc,
    snowLoad: value.snowLoad,
    windLoad: value.windLoad,
    categoryIds: value.categoryIds,
    resources: value.resources,
    status: DETAIL_STATUS.DRAFT,
  });

  return { ok: true, detailId: detail.id, oldImageUrl: null };
}

// Re-salvează o ciornă EXISTENTĂ (autorul, doar cât e DRAFT — `/details/[id]/edit`). Ownership +
// starea DRAFT se verifică prin `getDetailForEdit` (scoped pe owner în query, ca la Planșă — un DRAFT
// al altui user nu trebuie să scape nici măcar ca „not found după citire").
export async function saveDetailDraft(
  input: DraftDetailInput & { detailId: string; authorId: string },
): Promise<SaveDraftDetailResult> {
  if (!isUuid(input.detailId)) return { ok: false, error: "NOT_FOUND" };

  const existing = await getDetailForEdit(input.detailId, input.authorId);
  if (!existing || existing.status !== DETAIL_STATUS.DRAFT) return { ok: false, error: "NOT_FOUND" };

  const validation = await validateDraft(input);
  if (!validation.ok) return { ok: false, error: validation.error };
  const value = validation.value;

  if (value.categoryIds.some((id) => !isUuid(id))) return { ok: false, error: "INVALID_CATEGORY" };
  const existingCount = await countExistingCategoryIds(value.categoryIds);
  if (existingCount !== value.categoryIds.length) return { ok: false, error: "INVALID_CATEGORY" };

  await updateDetailRow(input.detailId, {
    title: value.title,
    description: value.description,
    imageUrl: value.imageUrl,
    climateZone: value.climateZone,
    seismicAg: value.seismicAg,
    seismicTc: value.seismicTc,
    snowLoad: value.snowLoad,
    windLoad: value.windLoad,
  });
  await replaceDetailCategories(input.detailId, value.categoryIds);
  await replaceDetailResources(input.detailId, value.resources);

  const imageChanged = existing.imageUrl !== value.imageUrl;
  return { ok: true, detailId: input.detailId, oldImageUrl: imageChanged ? existing.imageUrl : null };
}

// Publică o ciornă (DRAFT → PUBLISHED) — validare STRICTĂ (imagine + categorie obligatorii), la fel
// ca `createDetail`/`updateDetail`. Datele finale vin din formular (userul poate ajusta chiar înainte
// de publish), nu doar din ce era deja salvat.
export async function publishDetailDraft(
  input: DraftDetailInput & { detailId: string; authorId: string },
): Promise<SaveDraftDetailResult> {
  if (!isUuid(input.detailId)) return { ok: false, error: "NOT_FOUND" };

  const existing = await getDetailForEdit(input.detailId, input.authorId);
  if (!existing || existing.status !== DETAIL_STATUS.DRAFT) return { ok: false, error: "NOT_FOUND" };

  const validation = validateDetailInput({
    title: input.title,
    description: input.description,
    categoryIds: input.categoryIds ?? [],
    imageUrl: input.imageUrl ?? null,
    climateZone: input.climateZone,
    seismicAg: input.seismicAg,
    seismicTc: input.seismicTc,
    snowLoad: input.snowLoad,
    windLoad: input.windLoad,
    resources: input.resources,
  });
  if (!validation.ok) return { ok: false, error: validation.error };
  const value = validation.value;

  if (value.categoryIds.some((id) => !isUuid(id))) return { ok: false, error: "INVALID_CATEGORY" };
  const existingCount = await countExistingCategoryIds(value.categoryIds);
  if (existingCount !== value.categoryIds.length) return { ok: false, error: "INVALID_CATEGORY" };

  await updateDetailRow(input.detailId, {
    title: value.title,
    description: value.description,
    imageUrl: value.imageUrl,
    climateZone: value.climateZone,
    seismicAg: value.seismicAg,
    seismicTc: value.seismicTc,
    snowLoad: value.snowLoad,
    windLoad: value.windLoad,
  });
  await replaceDetailCategories(input.detailId, value.categoryIds);
  await replaceDetailResources(input.detailId, value.resources);
  await publishDetailRow(input.detailId);

  const imageChanged = existing.imageUrl !== value.imageUrl;
  return { ok: true, detailId: input.detailId, oldImageUrl: imageChanged ? existing.imageUrl : null };
}

// Fetch pt pagina de editare (draft SAU published, doar owner) — vezi nota din repo.
export async function getDetailForEditing(detailId: string, authorId: string) {
  if (!isUuid(detailId)) return null;
  const detail = await getDetailForEdit(detailId, authorId);
  if (!detail) return null;
  const resources = await getDetailResources(detailId);
  return { ...detail, resources };
}

// Ciornele de detaliu ale userului — pt „Ciornele mele" (unificat cu ciornele de schiță).
export function getMyDetailDrafts(userId: string) {
  return listDetailDraftsByAuthor(userId);
}

export type DeleteDraftDetailResult = { ok: true } | { ok: false; error: "NOT_FOUND" };

// Șterge o ciornă de detaliu (autorul, doar cât e DRAFT) — folosit din „Ciornele mele".
export async function deleteDetailDraft(input: {
  detailId: string;
  authorId: string;
}): Promise<DeleteDraftDetailResult> {
  if (!isUuid(input.detailId)) return { ok: false, error: "NOT_FOUND" };

  const detail = await getDetailForEdit(input.detailId, input.authorId);
  if (!detail || detail.status !== DETAIL_STATUS.DRAFT) return { ok: false, error: "NOT_FOUND" };

  const blobUrls = await deleteDetailCascade(input.detailId);
  await deleteBlobs([detail.imageUrl, ...blobUrls]);
  return { ok: true };
}

// Citire pagină de detaliu (doar PUBLISHED) + resursele atașate. null dacă nu există / id invalid.
export async function getDetail(id: string) {
  if (!isUuid(id)) return null;
  const detail = await getDetailById(id);
  if (!detail) return null;
  const resources = await getDetailResources(id);
  return { ...detail, resources };
}

export type DeleteDetailResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN" };

// Ștergerea unui detaliu de către AUTORUL lui (enforce pe SERVER — ownership, nu frontend).
//  - id malformat / inexistent → NOT_FOUND (nu dezvăluim existența).
//  - alt user decât autorul → FORBIDDEN (niciodată 404 ca să ascundem; vezi convențiile de authz).
// Curățarea în cascadă (resurse, schițe, validări, comentarii polimorfice) o face repo-ul, atomic.
// Blob-urile (imaginea detaliului + thumbnail-urile schițelor + resursele IMAGE/PDF/CAD) le ștergem
// best-effort după.
export async function deleteDetail(input: {
  detailId: string;
  userId: string;
}): Promise<DeleteDetailResult> {
  if (!isUuid(input.detailId)) return { ok: false, error: "NOT_FOUND" };

  const detail = await getDetailById(input.detailId);
  if (!detail) return { ok: false, error: "NOT_FOUND" };
  if (detail.authorId !== input.userId) return { ok: false, error: "FORBIDDEN" };

  const blobUrls = await deleteDetailCascade(input.detailId);
  await deleteBlobs([detail.imageUrl, ...blobUrls]);
  return { ok: true };
}

// Feed finit (~20), opțional filtrat pe categorie / căutare pe titlu, strict cronologic. Fără scroll infinit.
export async function getFeed(options?: { categoryId?: string | null; q?: string | null; limit?: number }) {
  const limit = options?.limit ?? DEFAULT_FEED_SIZE;
  return listFeed({
    categoryId: options?.categoryId ?? null,
    q: options?.q?.trim() || null,
    limit,
  });
}

// „În dezbatere acum" (rail-ul din feed) — top N global pe scor de interacțiune, independent de
// filtrele feed-ului principal.
export async function getTopDebated(limit: number) {
  return listTopDebated(limit);
}

// ───────────────────────── Bookmark (salvează detaliu) ─────────────────────────
// `userId` vine ÎNTOTDEAUNA din sesiune (nu din formular) → un user salvează/scoate doar pentru el.

// Este acest detaliu salvat de userul curent? (starea butonului din meniul de detaliu)
export async function isDetailSaved(userId: string, detailId: string): Promise<boolean> {
  if (!isUuid(detailId)) return false;
  return isDetailSavedByUser(userId, detailId);
}

// Care dintre detaliile date sunt salvate de userul curent — batch (feed), un singur query pt tot feed-ul
// (pattern identic cu getMyPositions din validationService).
export async function getMySavedDetailIds(userId: string, detailIds: string[]): Promise<Set<string>> {
  const ids = detailIds.filter(isUuid);
  if (ids.length === 0) return new Set();
  return new Set(await listSavedDetailIds(userId, ids));
}

// Comută salvarea unui detaliu (salvat ⇄ nesalvat). Verifică întâi existența (PUBLISHED) ca să nu
// creăm bookmark-uri către detalii inexistente. Întoarce noua stare pentru feedback UI.
export async function toggleSavedDetail(input: {
  userId: string;
  detailId: string;
}): Promise<{ saved: boolean }> {
  if (!isUuid(input.detailId)) return { saved: false };
  const detail = await getDetailById(input.detailId);
  if (!detail) return { saved: false };

  const already = await isDetailSavedByUser(input.userId, input.detailId);
  if (already) {
    await deleteSavedDetail(input.userId, input.detailId);
    return { saved: false };
  }
  await insertSavedDetail(input.userId, input.detailId);
  return { saved: true };
}

// Detaliile salvate de user (forma de card pentru pagina /saved).
export function getSavedDetails(userId: string) {
  return listSavedDetails(userId);
}

// Autori activi pentru rail-ul din feed (top după detalii publicate).
export function getActiveAuthors(limit = 5) {
  return listTopAuthors(limit);
}

// Detalii înrudite (cel puțin o categorie comună) pentru sidebar-ul paginii de detaliu.
// Gol dacă detaliul nu are nicio categorie.
export function getRelatedDetails(detailId: string, categoryIds: string[], limit = 5) {
  if (categoryIds.length === 0) return Promise.resolve([]);
  return listRelatedDetails({ detailId, categoryIds, limit });
}
