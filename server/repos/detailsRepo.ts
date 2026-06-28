// Repo detalii — singurul loc cu acces Drizzle pentru `details` și `detail_resources`.
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  comments,
  detailResources,
  details,
  roles,
  sketches,
  users,
  validations,
} from "@/db/schema";
import { DETAIL_STATUS, type DetailResourceInput } from "@/server/domain/detail";

export async function insertDetail(input: {
  title: string;
  description: string | null;
  authorId: string;
  categoryId: string;
  imageUrl: string;
  climateZone: string;
  seismicZone: string;
}) {
  const [row] = await db
    .insert(details)
    .values({
      title: input.title,
      description: input.description,
      authorId: input.authorId,
      categoryId: input.categoryId,
      imageUrl: input.imageUrl,
      climateZone: input.climateZone,
      seismicZone: input.seismicZone,
      // status rămâne pe default „PUBLISHED" (moderare post-publicare).
    })
    .returning();
  return row;
}

export async function insertDetailResources(detailId: string, resources: DetailResourceInput[]) {
  if (resources.length === 0) return;
  await db.insert(detailResources).values(
    resources.map((r) => ({
      detailId,
      type: r.type,
      url: r.url ?? null,
      body: r.body ?? null,
    })),
  );
}

// Forma de afișare a unui detaliu cu autor (nume+rol) și categorie — folosită pe pagina de detaliu și în feed.
const detailWithAuthorColumns = {
  id: details.id,
  title: details.title,
  description: details.description,
  imageUrl: details.imageUrl,
  climateZone: details.climateZone,
  seismicZone: details.seismicZone,
  status: details.status,
  createdAt: details.createdAt,
  categoryId: details.categoryId,
  categoryName: categories.name,
  categorySlug: categories.slug,
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
    .leftJoin(categories, eq(categories.id, details.categoryId))
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(and(eq(details.id, id), eq(details.status, DETAIL_STATUS.PUBLISHED)))
    .limit(1);
  return row ?? null;
}

// Șterge un detaliu + tot ce atârnă de el, ATOMIC. `detail_resources` și `sketches` cad în cascadă
// (FK onDelete: cascade). DAR validările și comentariile sunt POLIMORFICE (target_type/target_id, fără
// FK către details/sketches) → trebuie șterse manual: cele de pe detaliu ȘI cele de pe schițele lui.
// Neon HTTP n-are tranzacții interactive → folosim `db.batch` (un singur batch atomic).
// Întoarce URL-urile de thumbnail ale schițelor (pt curățarea blob best-effort din service).
export async function deleteDetailCascade(detailId: string): Promise<string[]> {
  const sketchRows = await db
    .select({ id: sketches.id, thumbnailUrl: sketches.thumbnailUrl })
    .from(sketches)
    .where(eq(sketches.detailId, detailId));
  const sketchIds = sketchRows.map((s) => s.id);

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

  return sketchRows.map((s) => s.thumbnailUrl).filter((u): u is string => !!u);
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
export async function listFeed(input: {
  categoryId?: string | null;
  q?: string | null;
  limit: number;
  sort?: "debated" | "recent";
}) {
  const conds = [eq(details.status, DETAIL_STATUS.PUBLISHED)];
  if (input.categoryId) conds.push(eq(details.categoryId, input.categoryId));
  // Căutare simplă pe titlu (ILIKE, case-insensitive). `%` din input e escapat ca să fie literal.
  if (input.q) {
    const term = `%${input.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(sql`${details.title} ilike ${term}`);
  }
  const where = and(...conds);

  // „recent" = doar după dată; „debated" (default) = după interacțiuni, tie-break pe dată.
  const orderBy =
    input.sort === "recent"
      ? [desc(details.createdAt)]
      : [sql`${interactionScore} desc`, desc(details.createdAt)];

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
    .leftJoin(categories, eq(categories.id, details.categoryId))
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(where)
    .orderBy(...orderBy)
    .limit(input.limit);
}

// Detalii înrudite = aceeași categorie, PUBLISHED, exclus self. Pentru sidebar-ul paginii de detaliu.
// Sortare după interacțiuni (cele mai dezbătute întâi), tie-break pe dată.
export async function listRelatedDetails(input: {
  detailId: string;
  categoryId: string;
  limit: number;
}) {
  return db
    .select({
      id: details.id,
      title: details.title,
      authorName: users.name,
      authorRoleMain: roles.roleMain,
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
        eq(details.categoryId, input.categoryId),
        ne(details.id, input.detailId),
      ),
    )
    .orderBy(sql`${interactionScore} desc`, desc(details.createdAt))
    .limit(input.limit);
}

export type DetailWithAuthor = Awaited<ReturnType<typeof getDetailById>>;
export type FeedItem = Awaited<ReturnType<typeof listFeed>>[number];
export type RelatedDetail = Awaited<ReturnType<typeof listRelatedDetails>>[number];
