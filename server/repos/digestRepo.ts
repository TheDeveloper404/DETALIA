// Repo digest săptămânal — singurul loc cu acces Drizzle pentru datele emailului de digest
// (`/api/cron/weekly-digest`). Citiri agregate pe o fereastră de 7 zile; nicio mutație aici
// (dezabonarea stă în usersRepo). Toate query-urile de „activitate pe detaliile tale" grupează pe
// `details.authorId` — comparațiile `<>` sunt condiții de JOIN pe coloane reale, calificate de
// Drizzle (nu subquery-uri corelate, deci nu capcana din CLAUDE.md).
import { and, count, desc, eq, gte, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { comments, details, roles, sketches, users, validations } from "@/db/schema";

// Destinatarii: cont ACTIV, cu rol declarat, cu flagul de digest pe true. `email` e NOT NULL în schemă.
export async function listDigestRecipients(): Promise<
  { id: string; email: string; name: string | null }[]
> {
  return db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .innerJoin(roles, eq(roles.userId, users.id))
    .where(and(eq(users.status, "ACTIVE"), eq(users.weeklyDigestEnabled, true)));
}

// Nr. de comentarii NOI (de la alții, fără justificări de dezaprobare) pe detaliile PUBLICATE ale
// fiecărui autor, în fereastra dată. Map ownerId→count.
export async function countCommentsOnOwnDetails(since: Date): Promise<Map<string, number>> {
  const rows = await db
    .select({ ownerId: details.authorId, cnt: count() })
    .from(comments)
    .innerJoin(details, and(eq(comments.targetType, "DETAIL"), eq(comments.targetId, details.id)))
    .where(
      and(
        gte(comments.createdAt, since),
        ne(comments.authorId, details.authorId),
        isNull(details.anonymizedAt),
        // Doar detalii PUBLICATE — un detaliu întors în DRAFT nu mai trebuie să tragă digestul (CTA-ul
        // duce la /profile unde activitatea pe ciornă nici nu se vede).
        eq(details.status, "PUBLISHED"),
        // O dezaprobare scrie ȘI un comentariu (cu `originValidationId`) ȘI un rând în `validations` —
        // altfel aceeași acțiune s-ar număra de două ori (aici + `countValidationsOnOwnDetails`).
        isNull(comments.originValidationId),
      ),
    )
    .groupBy(details.authorId);
  return new Map(rows.map((r) => [r.ownerId, Number(r.cnt)]));
}

// Nr. de schițe NOI (de la alții, publicate, non-adnotare) pe detaliile fiecărui autor.
export async function countSketchesOnOwnDetails(since: Date): Promise<Map<string, number>> {
  const rows = await db
    .select({ ownerId: details.authorId, cnt: count() })
    .from(sketches)
    .innerJoin(details, eq(sketches.detailId, details.id))
    .where(
      and(
        gte(sketches.createdAt, since),
        eq(sketches.status, "PUBLISHED"),
        eq(sketches.isAnnotation, false),
        ne(sketches.authorId, details.authorId),
        isNull(details.anonymizedAt),
        eq(details.status, "PUBLISHED"),
      ),
    )
    .groupBy(details.authorId);
  return new Map(rows.map((r) => [r.ownerId, Number(r.cnt)]));
}

// Nr. de poziții NOI (de la alții) pe detaliile fiecărui autor.
export async function countValidationsOnOwnDetails(since: Date): Promise<Map<string, number>> {
  const rows = await db
    .select({ ownerId: details.authorId, cnt: count() })
    .from(validations)
    .innerJoin(details, and(eq(validations.targetType, "DETAIL"), eq(validations.targetId, details.id)))
    .where(
      and(
        gte(validations.createdAt, since),
        ne(validations.userId, details.authorId),
        isNull(details.anonymizedAt),
        eq(details.status, "PUBLISHED"),
      ),
    )
    .groupBy(details.authorId);
  return new Map(rows.map((r) => [r.ownerId, Number(r.cnt)]));
}

// Detalii PUBLICE noi din fereastră (exclude proiect + autori retrași), „top" după vizualizări apoi
// recență. Egal pentru toți destinatarii — secțiunea „Nou pe DETALIA".
export async function listNewCommunityDetails(
  since: Date,
  limit: number,
): Promise<{ id: string; title: string; authorName: string | null }[]> {
  return db
    .select({ id: details.id, title: details.title, authorName: users.name })
    .from(details)
    .innerJoin(users, eq(details.authorId, users.id))
    .where(
      and(
        eq(details.status, "PUBLISHED"),
        isNull(details.projectId),
        isNull(details.anonymizedAt),
        gte(details.createdAt, since),
      ),
    )
    .orderBy(desc(details.views), desc(details.createdAt))
    .limit(limit);
}
