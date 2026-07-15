// Repo detalii — singurul loc cu acces Drizzle pentru `details` și `detail_resources`.
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { and, desc, eq, exists, inArray, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  comments,
  detailCategories,
  detailResources,
  details,
  roles,
  savedDetails,
  sketches,
  users,
  validations,
} from "@/db/schema";
import { DETAIL_STATUS, type DetailResourceInput } from "@/server/domain/detail";

// Creează detaliul + categoriile + resursele într-un SINGUR `db.batch` (atomic). Neon HTTP nu are
// tranzacții interactive, dar `batch` trimite toate query-urile într-o singură rundă atomică — posibil
// aici pentru că id-ul detaliului e generat CLIENT-SIDE (crypto.randomUUID()), nu de `defaultRandom()`
// al coloanei, deci detailCategories/detailResources pot referi id-ul înainte ca insert-ul să se fi
// „întors" cu `.returning()`. Înlocuiește vechiul flux secvențial (detail → categorii → resurse), unde
// o eroare la mijloc putea lăsa un detaliu fără categorii/resurse.
export async function insertDetailWithRelations(input: {
  title: string;
  description: string | null;
  authorId: string;
  imageUrl: string | null;
  climateZone: string | null;
  seismicAg: string;
  seismicTc: string;
  snowLoad: string;
  windLoad: string;
  categoryIds: string[];
  resources: DetailResourceInput[];
  // Implicit PUBLISHED (moderare post-publicare) — DRAFT doar la „Salvează ciornă".
  status?: typeof DETAIL_STATUS.DRAFT | typeof DETAIL_STATUS.PUBLISHED;
}): Promise<{ id: string }> {
  const id = crypto.randomUUID();

  const insertDetailStatement = db
    .insert(details)
    .values({
      id,
      title: input.title,
      description: input.description,
      authorId: input.authorId,
      imageUrl: input.imageUrl,
      climateZone: input.climateZone,
      seismicAg: input.seismicAg,
      seismicTc: input.seismicTc,
      snowLoad: input.snowLoad,
      windLoad: input.windLoad,
      status: input.status ?? DETAIL_STATUS.PUBLISHED,
    })
    .returning({ id: details.id });

  // `db.batch` cere doar un array NEVID (`Readonly<[U, ...U[]]>`), nu un tuplu de lungime fixă 2/3 —
  // insertDetailStatement e mereu prezent, deci array-ul e mereu nevid; nu e nevoie de ramuri separate
  // pe combinația categorii/resurse (relații opționale viitoare se adaugă la fel, fără combinatorică nouă).
  const optionalStatements = [
    input.categoryIds.length
      ? db
          .insert(detailCategories)
          .values(input.categoryIds.map((categoryId) => ({ detailId: id, categoryId })))
      : null,
    input.resources.length
      ? db.insert(detailResources).values(
          input.resources.map((r) => ({
            detailId: id,
            type: r.type,
            url: r.url ?? null,
            body: r.body ?? null,
          })),
        )
      : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  const [detailResult] = await db.batch([insertDetailStatement, ...optionalStatements]);
  if (detailResult.length === 0) {
    throw new Error("insertDetailWithRelations: insertul detaliului nu a produs niciun rând");
  }
  return { id };
}

// EXISTS pe join-ul detail_categories — „acest detaliu are bifată cel puțin una din categoriile date".
function hasAnyCategory(categoryIds: string[]) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(detailCategories)
      .where(
        and(eq(detailCategories.detailId, details.id), inArray(detailCategories.categoryId, categoryIds)),
      ),
  );
}

// Actualizează câmpurile editabile ale unui detaliu (titlu, descriere, imagine, parametri tehnici).
// Ownership-ul se verifică ÎNAINTE, în service. `updated_at` se împinge la now.
export async function updateDetailRow(
  detailId: string,
  input: {
    title: string;
    description: string | null;
    imageUrl: string | null;
    climateZone: string | null;
    seismicAg: string;
    seismicTc: string;
    snowLoad: string;
    windLoad: string;
  },
) {
  await db
    .update(details)
    .set({
      title: input.title,
      description: input.description,
      imageUrl: input.imageUrl,
      climateZone: input.climateZone,
      seismicAg: input.seismicAg,
      seismicTc: input.seismicTc,
      snowLoad: input.snowLoad,
      windLoad: input.windLoad,
      updatedAt: new Date(),
    })
    .where(eq(details.id, detailId));
}

// Înlocuiește complet setul de categorii al unui detaliu (delete-all + insert). Neon HTTP n-are
// tranzacții interactive → batch atomic când există și inserare.
export async function replaceDetailCategories(detailId: string, categoryIds: string[]) {
  if (categoryIds.length === 0) {
    await db.delete(detailCategories).where(eq(detailCategories.detailId, detailId));
    return;
  }
  await db.batch([
    db.delete(detailCategories).where(eq(detailCategories.detailId, detailId)),
    db.insert(detailCategories).values(categoryIds.map((categoryId) => ({ detailId, categoryId }))),
  ]);
}

// Înlocuiește complet resursele unui detaliu (delete-all + insert).
export async function replaceDetailResources(detailId: string, resources: DetailResourceInput[]) {
  if (resources.length === 0) {
    await db.delete(detailResources).where(eq(detailResources.detailId, detailId));
    return;
  }
  await db.batch([
    db.delete(detailResources).where(eq(detailResources.detailId, detailId)),
    db.insert(detailResources).values(
      resources.map((r) => ({
        detailId,
        type: r.type,
        url: r.url ?? null,
        body: r.body ?? null,
      })),
    ),
  ]);
}

// Ciornele de DETALIU ale unui user (pt „Ciornele mele", unificat cu ciornele de schiță).
export function listDetailDraftsByAuthor(authorId: string) {
  return db
    .select({ id: details.id, title: details.title, imageUrl: details.imageUrl, createdAt: details.createdAt })
    .from(details)
    .where(and(eq(details.authorId, authorId), eq(details.status, DETAIL_STATUS.DRAFT)))
    .orderBy(desc(details.createdAt));
}

// Categoriile bifate pe un detaliu, ca array JSON — subquery corelat (nu join), ca să nu dublăm
// rândurile detaliului când sunt mai multe categorii (Edi: „bifezi oricâte").
const detailCategoriesJson = sql<{ id: string; name: string; slug: string }[]>`(
  select coalesce(json_agg(json_build_object('id', ${categories.id}, 'name', ${categories.name}, 'slug', ${categories.slug}) order by ${categories.name}), '[]'::json)
  from ${detailCategories}
  join ${categories} on ${categories.id} = ${detailCategories.categoryId}
  where ${detailCategories.detailId} = ${details.id}
)`;

// Forma de afișare a unui detaliu cu autor (nume+rol) și categorii — folosită pe pagina de detaliu și în feed.
const detailWithAuthorColumns = {
  id: details.id,
  title: details.title,
  description: details.description,
  imageUrl: details.imageUrl,
  climateZone: details.climateZone,
  seismicAg: details.seismicAg,
  seismicTc: details.seismicTc,
  snowLoad: details.snowLoad,
  windLoad: details.windLoad,
  status: details.status,
  createdAt: details.createdAt,
  categories: detailCategoriesJson,
  authorId: details.authorId,
  authorName: users.name,
  authorImage: users.image,
  authorLocation: users.location,
  authorHeadline: users.headline,
  authorRoleMain: roles.roleMain,
  authorSubRole: roles.subRole,
  authorVerification: roles.verificationStatus,
} as const;

export async function getDetailResources(detailId: string) {
  return db
    .select({
      id: detailResources.id,
      type: detailResources.type,
      url: detailResources.url,
      body: detailResources.body,
    })
    .from(detailResources)
    .where(eq(detailResources.detailId, detailId));
}

export async function getDetailById(id: string) {
  const [row] = await db
    .select(detailWithAuthorColumns)
    .from(details)
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(and(eq(details.id, id), eq(details.status, DETAIL_STATUS.PUBLISHED)))
    .limit(1);
  return row ?? null;
}

// Fetch pt pagina de EDITARE — spre deosebire de `getDetailById`, NU filtrează pe status (owner-ul
// trebuie să-și poată edita atât un detaliu publicat, cât și o ciornă DRAFT). Scoping-ul pe owner e
// AICI, în query (nu doar verificat după) — un DRAFT al altui user nu trebuie niciodată să ajungă la
// client, nici măcar ca răspuns „not found după citire".
export async function getDetailForEdit(id: string, ownerId: string) {
  const [row] = await db
    .select(detailWithAuthorColumns)
    .from(details)
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(and(eq(details.id, id), eq(details.authorId, ownerId)))
    .limit(1);
  return row ?? null;
}

// Tranziția DRAFT → PUBLISHED (materializează publicarea unei ciorne de detaliu).
export async function publishDetailRow(detailId: string) {
  await db
    .update(details)
    .set({ status: DETAIL_STATUS.PUBLISHED, updatedAt: new Date() })
    .where(and(eq(details.id, detailId), eq(details.status, DETAIL_STATUS.DRAFT)));
}

// Șterge un detaliu + tot ce atârnă de el, ATOMIC. `detail_resources` și `sketches` cad în cascadă
// (FK onDelete: cascade). DAR validările și comentariile sunt POLIMORFICE (target_type/target_id, fără
// FK către details/sketches) → trebuie șterse manual: cele de pe detaliu ȘI cele de pe schițele lui.
// Neon HTTP n-are tranzacții interactive → folosim `db.batch` (un singur batch atomic).
// Întoarce URL-urile de blob de curățat best-effort din service (thumbnail-uri schițe + resurse IMAGE/PDF/CAD;
// LINK/TEXT nu au fișier în Blob-ul nostru — LINK e URL extern).
export async function deleteDetailCascade(detailId: string): Promise<string[]> {
  const sketchRows = await db
    .select({ id: sketches.id, thumbnailUrl: sketches.thumbnailUrl })
    .from(sketches)
    .where(eq(sketches.detailId, detailId));
  const sketchIds = sketchRows.map((s) => s.id);

  const resourceRows = await db
    .select({ url: detailResources.url })
    .from(detailResources)
    .where(
      and(
        eq(detailResources.detailId, detailId),
        inArray(detailResources.type, ["IMAGE", "PDF", "CAD"]),
      ),
    );

  const valWhere = sketchIds.length
    ? or(
        and(eq(validations.targetType, "DETAIL"), eq(validations.targetId, detailId)),
        and(eq(validations.targetType, "SKETCH"), inArray(validations.targetId, sketchIds)),
      )
    : and(eq(validations.targetType, "DETAIL"), eq(validations.targetId, detailId));

  const comWhere = sketchIds.length
    ? or(
        and(eq(comments.targetType, "DETAIL"), eq(comments.targetId, detailId)),
        and(eq(comments.targetType, "SKETCH"), inArray(comments.targetId, sketchIds)),
      )
    : and(eq(comments.targetType, "DETAIL"), eq(comments.targetId, detailId));

  await db.batch([
    db.delete(validations).where(valWhere),
    db.delete(comments).where(comWhere),
    db.delete(details).where(eq(details.id, detailId)), // cascade → detail_resources + sketches
  ]);

  return [...sketchRows.map((s) => s.thumbnailUrl), ...resourceRows.map((r) => r.url)].filter(
    (u): u is string => !!u,
  );
}

// Counts de interacțiune per detaliu (polimorfice, pe DETAIL) — subquery-uri corelate (nu join-uri)
// ca să nu dublăm rândurile când există mai multe interacțiuni. `::int` ca să vină number, nu string.
const validationCount = sql<number>`(select count(*)::int from ${validations}
   where ${validations.targetType} = 'DETAIL' and ${validations.targetId} = ${details.id})`;
const commentCount = sql<number>`(select count(*)::int from ${comments}
   where ${comments.targetType} = 'DETAIL' and ${comments.targetId} = ${details.id})`;
const sketchCount = sql<number>`(select count(*)::int from ${sketches}
   where ${sketches.detailId} = ${details.id} and ${sketches.status} = 'PUBLISHED')`;

// Scor de interacțiune = suma celor trei (caracter de comunitate, pentru sortare).
const interactionScore = sql<number>`(${validationCount} + ${commentCount} + ${sketchCount})`;

// Avatarele validatorilor (max 5, cei mai recenți) pentru stiva de pe cardul de feed —
// „cine a luat poziție". Subquery corelat → array JSON, ca să nu dublăm rândurile detaliului.
// Overflow-ul (+N) îl calculează UI-ul din validationCount, nu îl aducem aici.
const validatorAvatars = sql<{ name: string | null; image: string | null }[]>`(
  select coalesce(json_agg(json_build_object('name', sub.name, 'image', sub.image)), '[]'::json)
  from (
    select ${users.name} as name, ${users.image} as image
    from ${validations}
    join ${users} on ${users.id} = ${validations.userId}
    where ${validations.targetType} = 'DETAIL' and ${validations.targetId} = ${details.id}
    order by ${validations.createdAt} desc
    limit 5
  ) sub
)`;

// Feed finit: doar PUBLISHED, opțional filtrat pe categorie, limitat.
// Sortare după interacțiuni (caracter de comunitate), tie-break după dată descrescătoare.
export async function listFeed(input: { categoryId?: string | null; q?: string | null; limit: number }) {
  const conds = [eq(details.status, DETAIL_STATUS.PUBLISHED)];
  if (input.categoryId) conds.push(hasAnyCategory([input.categoryId]));
  // Căutare simplă pe titlu (ILIKE, case-insensitive). `%` din input e escapat ca să fie literal.
  if (input.q) {
    const term = `%${input.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(sql`${details.title} ilike ${term}`);
  }
  const where = and(...conds);

  return db
    .select({
      ...detailWithAuthorColumns,
      validationCount,
      commentCount,
      sketchCount,
      validatorAvatars,
      interactionCount: interactionScore,
    })
    .from(details)
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(where)
    .orderBy(desc(details.createdAt))
    .limit(input.limit);
}

// „Cele mai dezbătute" (rail-ul din feed) — top N global pe scor de interacțiune (validări+comentarii+
// schițe), independent de filtrele/paginarea feed-ului principal (altfel rail-ul ar reflecta doar un
// subset, nu adevăratul top). Feed-ul principal e strict cronologic — vezi `listFeed`.
export async function listTopDebated(limit: number) {
  return db
    .select({
      id: details.id,
      title: details.title,
      categories: detailCategoriesJson,
      authorName: users.name,
      authorImage: users.image,
      authorRoleMain: roles.roleMain,
      authorSubRole: roles.subRole,
      authorVerification: roles.verificationStatus,
      validationCount,
      commentCount,
      sketchCount,
    })
    .from(details)
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(eq(details.status, DETAIL_STATUS.PUBLISHED))
    .orderBy(sql`${interactionScore} desc`, desc(details.createdAt))
    .limit(limit);
}

// Detalii înrudite = cel puțin o categorie comună (Edi: „bifezi oricâte"), PUBLISHED, exclus self.
// Pentru sidebar-ul paginii de detaliu. Sortare după interacțiuni, tie-break pe dată.
export async function listRelatedDetails(input: {
  detailId: string;
  categoryIds: string[];
  limit: number;
}) {
  if (input.categoryIds.length === 0) return [];
  return db
    .select({
      id: details.id,
      title: details.title,
      authorName: users.name,
      authorRoleMain: roles.roleMain,
      authorSubRole: roles.subRole,
      authorVerification: roles.verificationStatus,
      commentCount,
      sketchCount,
    })
    .from(details)
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(
      and(
        eq(details.status, DETAIL_STATUS.PUBLISHED),
        hasAnyCategory(input.categoryIds),
        ne(details.id, input.detailId),
      ),
    )
    .orderBy(sql`${interactionScore} desc`, desc(details.createdAt))
    .limit(input.limit);
}

// ───────────────────────── Bookmark (saved_details) ─────────────────────────

// Salvează un detaliu pentru un user. Idempotent: dacă e deja salvat, nu face nimic (PK compus).
export async function insertSavedDetail(userId: string, detailId: string) {
  await db
    .insert(savedDetails)
    .values({ userId, detailId })
    .onConflictDoNothing({ target: [savedDetails.userId, savedDetails.detailId] });
}

// Scoate un detaliu din salvate (doar rândul userului curent).
export async function deleteSavedDetail(userId: string, detailId: string) {
  await db
    .delete(savedDetails)
    .where(and(eq(savedDetails.userId, userId), eq(savedDetails.detailId, detailId)));
}

// „Userul a salvat acest detaliu?" — pentru starea butonului din meniul de detaliu.
export async function isDetailSavedByUser(userId: string, detailId: string): Promise<boolean> {
  const [row] = await db
    .select({ one: sql`1` })
    .from(savedDetails)
    .where(and(eq(savedDetails.userId, userId), eq(savedDetails.detailId, detailId)))
    .limit(1);
  return !!row;
}

// Care dintre detaliile date sunt deja salvate de user — batch (feed), evită N+1 (pattern identic cu
// getMyPositions din validationService).
export async function listSavedDetailIds(userId: string, detailIds: string[]): Promise<string[]> {
  if (detailIds.length === 0) return [];
  const rows = await db
    .select({ detailId: savedDetails.detailId })
    .from(savedDetails)
    .where(and(eq(savedDetails.userId, userId), inArray(savedDetails.detailId, detailIds)));
  return rows.map((r) => r.detailId);
}

// Detaliile salvate de un user, în forma de card (FeedItem) — refolosește DetailCard din feed.
// Doar PUBLISHED (un detaliu șters cade oricum din saved_details prin FK cascade). Ordine: cele mai
// recent salvate primele (după saved_details.created_at, nu după data detaliului).
export async function listSavedDetails(userId: string) {
  return db
    .select({
      ...detailWithAuthorColumns,
      validationCount,
      commentCount,
      sketchCount,
      validatorAvatars,
      interactionCount: interactionScore,
    })
    .from(savedDetails)
    .innerJoin(details, eq(details.id, savedDetails.detailId))
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(and(eq(savedDetails.userId, userId), eq(details.status, DETAIL_STATUS.PUBLISHED)))
    .orderBy(desc(savedDetails.createdAt));
}

export type FeedItem = Awaited<ReturnType<typeof listFeed>>[number];
