// Repo profil — agregări pentru pagina de profil (stats + taburi Detalii/Schițe/Activitate).
// Totul DERIVAT din tabelele existente (fără tabel de evenimente separat): validations/comments/details/sketches
// au deja `created_at`. Citiri, fără mutații.
import { alias } from "drizzle-orm/pg-core";
import { and, count, desc, eq, gte, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { type PgColumn } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { categories, comments, details, sketches, validations } from "@/db/schema";

// Ziua (UTC) a unui timestamp, ca 'YYYY-MM-DD' — cheie pentru heatmap-ul de contribuții.
function dayUtc(col: PgColumn): SQL<string> {
  return sql<string>`to_char(${col} at time zone 'UTC', 'YYYY-MM-DD')`;
}

// Contribuții pe zi (UTC) din momentul `since`: validări date + comentarii + detalii publicate + schițe trimise.
// DERIVAT din tabele (fără activity log). Întoarce Map zi→număr total de contribuții.
export async function getContributionCounts(
  userId: string,
  since: Date,
): Promise<Map<string, number>> {
  const vDay = dayUtc(validations.createdAt);
  const cDay = dayUtc(comments.createdAt);
  const dDay = dayUtc(details.createdAt);
  const sDay = dayUtc(sketches.createdAt);

  const [v, c, d, s] = await Promise.all([
    db
      .select({ day: vDay, c: count() })
      .from(validations)
      .where(and(eq(validations.userId, userId), gte(validations.createdAt, since)))
      .groupBy(vDay),
    db
      .select({ day: cDay, c: count() })
      .from(comments)
      .where(and(eq(comments.authorId, userId), gte(comments.createdAt, since)))
      .groupBy(cDay),
    db
      .select({ day: dDay, c: count() })
      .from(details)
      .where(
        and(
          eq(details.authorId, userId),
          eq(details.status, "PUBLISHED"),
          gte(details.createdAt, since),
        ),
      )
      .groupBy(dDay),
    db
      .select({ day: sDay, c: count() })
      .from(sketches)
      .where(
        and(eq(sketches.authorId, userId), ne(sketches.status, "DRAFT"), gte(sketches.createdAt, since)),
      )
      .groupBy(sDay),
  ]);

  const map = new Map<string, number>();
  for (const rows of [v, c, d, s]) {
    for (const r of rows) map.set(r.day, (map.get(r.day) ?? 0) + Number(r.c));
  }
  return map;
}

// ── Statistici (4 contoare mici, indexate) ──────────────────────────────────
export async function getProfileStats(userId: string) {
  const myDetailIds = db
    .select({ id: details.id })
    .from(details)
    .where(eq(details.authorId, userId));
  const mySketchIds = db
    .select({ id: sketches.id })
    .from(sketches)
    .where(eq(sketches.authorId, userId));

  const [published, sketchesProposed, given, received] = await Promise.all([
    db
      .select({ c: count() })
      .from(details)
      .where(and(eq(details.authorId, userId), eq(details.status, "PUBLISHED"))),
    // „Schițe propuse" = trimise (orice în afară de DRAFT).
    db
      .select({ c: count() })
      .from(sketches)
      .where(and(eq(sketches.authorId, userId), ne(sketches.status, "DRAFT"))),
    db.select({ c: count() }).from(validations).where(eq(validations.userId, userId)),
    // Validări primite = poziții luate de alții pe detaliile/schițele acestui user.
    db
      .select({ c: count() })
      .from(validations)
      .where(
        or(
          and(
            eq(validations.targetType, "DETAIL"),
            inArray(validations.targetId, myDetailIds),
          ),
          and(
            eq(validations.targetType, "SKETCH"),
            inArray(validations.targetId, mySketchIds),
          ),
        ),
      ),
  ]);

  return {
    published: published[0]?.c ?? 0,
    sketches: sketchesProposed[0]?.c ?? 0,
    validationsGiven: given[0]?.c ?? 0,
    validationsReceived: received[0]?.c ?? 0,
  };
}

// ── Tab Detalii — detaliile PUBLISHED ale userului, cu contoare. ─────────────
const detailValidationCount = sql<number>`(select count(*)::int from ${validations}
   where ${validations.targetType} = 'DETAIL' and ${validations.targetId} = ${details.id})`;
const detailSketchCount = sql<number>`(select count(*)::int from ${sketches}
   where ${sketches.detailId} = ${details.id} and ${sketches.status} = 'PUBLISHED')`;

export function listAuthorDetails(userId: string) {
  return db
    .select({
      id: details.id,
      title: details.title,
      imageUrl: details.imageUrl,
      categoryName: categories.name,
      validationCount: detailValidationCount,
      sketchCount: detailSketchCount,
    })
    .from(details)
    .leftJoin(categories, eq(categories.id, details.categoryId))
    .where(and(eq(details.authorId, userId), eq(details.status, "PUBLISHED")))
    .orderBy(desc(details.createdAt));
}

// ── Tab Schițe — schițele trimise ale userului (non-DRAFT), cu titlul detaliului-mamă. ──
export function listAuthorSketches(userId: string) {
  return db
    .select({
      id: sketches.id,
      status: sketches.status,
      detailId: sketches.detailId,
      parentTitle: details.title,
    })
    .from(sketches)
    .innerJoin(details, eq(details.id, sketches.detailId))
    .where(and(eq(sketches.authorId, userId), ne(sketches.status, "DRAFT")))
    .orderBy(desc(sketches.createdAt));
}

// ── Tab Activitate — flux derivat (validări + comentarii + publicări), cel mai recent sus. ──
// Titlul țintei polimorfice se rezolvă prin join-uri: DETAIL direct, SKETCH → detaliul-mamă.
const sketchParent = alias(details, "sketch_parent_detail");

export async function listAuthorActivity(userId: string, limit: number) {
  // Validări (aprob/dezaprob) + titlul țintei.
  const vRows = await db
    .select({
      id: validations.id,
      position: validations.position,
      createdAt: validations.createdAt,
      roleSnapshot: validations.roleSnapshot, // rolul la momentul votului (afișare istorică)
      detailTitle: details.title,
      sketchParentTitle: sketchParent.title,
    })
    .from(validations)
    .leftJoin(
      details,
      and(eq(validations.targetType, "DETAIL"), eq(details.id, validations.targetId)),
    )
    .leftJoin(
      sketches,
      and(eq(validations.targetType, "SKETCH"), eq(sketches.id, validations.targetId)),
    )
    .leftJoin(sketchParent, eq(sketchParent.id, sketches.detailId))
    .where(eq(validations.userId, userId))
    .orderBy(desc(validations.createdAt))
    .limit(limit);

  // Comentarii + titlul țintei.
  const cRows = await db
    .select({
      id: comments.id,
      createdAt: comments.createdAt,
      isJustification: sql<boolean>`${comments.originValidationId} is not null`,
      detailTitle: details.title,
      sketchParentTitle: sketchParent.title,
    })
    .from(comments)
    .leftJoin(
      details,
      and(eq(comments.targetType, "DETAIL"), eq(details.id, comments.targetId)),
    )
    .leftJoin(
      sketches,
      and(eq(comments.targetType, "SKETCH"), eq(sketches.id, comments.targetId)),
    )
    .leftJoin(sketchParent, eq(sketchParent.id, sketches.detailId))
    .where(eq(comments.authorId, userId))
    .orderBy(desc(comments.createdAt))
    .limit(limit);

  // Detalii publicate.
  const dRows = await db
    .select({ id: details.id, title: details.title, createdAt: details.createdAt })
    .from(details)
    .where(and(eq(details.authorId, userId), eq(details.status, "PUBLISHED")))
    .orderBy(desc(details.createdAt))
    .limit(limit);

  return { vRows, cRows, dRows };
}
