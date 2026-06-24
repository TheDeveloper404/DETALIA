// Repo detalii — singurul loc cu acces Drizzle pentru `details` și `detail_resources`.
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { and, desc, eq, sql } from "drizzle-orm";

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

// Feed finit: doar PUBLISHED, opțional filtrat pe categorie, limitat.
// Sortare după interacțiuni (caracter de comunitate), tie-break după dată descrescătoare.
export async function listFeed(input: { categoryId?: string | null; limit: number }) {
  const where = input.categoryId
    ? and(eq(details.status, DETAIL_STATUS.PUBLISHED), eq(details.categoryId, input.categoryId))
    : eq(details.status, DETAIL_STATUS.PUBLISHED);

  return db
    .select({
      ...detailWithAuthorColumns,
      validationCount,
      commentCount,
      sketchCount,
      interactionCount: interactionScore,
    })
    .from(details)
    .leftJoin(categories, eq(categories.id, details.categoryId))
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(where)
    .orderBy(sql`${interactionScore} desc`, desc(details.createdAt))
    .limit(input.limit);
}

export type DetailWithAuthor = Awaited<ReturnType<typeof getDetailById>>;
export type FeedItem = Awaited<ReturnType<typeof listFeed>>[number];
