// Repo digest săptămânal — singurul loc cu acces Drizzle pentru datele emailului de digest
// (`/api/cron/weekly-digest`). Citiri agregate pe o fereastră de 7 zile; nicio mutație aici
// (dezabonarea stă în usersRepo). Comentariile si schitele se grupeaza pe destinatarul activitatii,
// inclusiv contributiile proprii aflate pe detaliile altora.
import { and, count, desc, eq, gte, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { comments, details, roles, sketches, users, validations } from "@/db/schema";
import { hasProjectAccessForUser } from "./detailsRepo";

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

// Activitate primita pe detaliu, in firul propriu ori pe schita proprie. Numele istoric al functiei
// este pastrat; cheia hartii este destinatarul, care poate fi diferit de autorul detaliului.
export async function countCommentsOnOwnDetails(since: Date): Promise<Map<string, number>> {
  const root = alias(comments, "digest_root");
  const replyTo = alias(comments, "digest_reply_to");
  const context = alias(sketches, "digest_context");
  const rows = await db
    .select({ ownerId: users.id, cnt: count() })
    .from(comments)
    .innerJoin(details, and(eq(comments.targetType, "DETAIL"), eq(comments.targetId, details.id)))
    .leftJoin(root, eq(root.id, comments.parentCommentId))
    .leftJoin(replyTo, eq(replyTo.id, comments.replyToCommentId))
    .leftJoin(
      context,
      and(eq(context.id, comments.sketchContextId), eq(context.detailId, details.id)),
    )
    .innerJoin(
      users,
      or(
        and(eq(users.id, details.authorId), isNull(details.anonymizedAt)),
        eq(users.id, root.authorId),
        eq(users.id, replyTo.authorId),
        and(eq(users.id, context.authorId), eq(context.authorRemoved, false)),
      ),
    )
    .where(
      and(
        gte(comments.createdAt, since),
        eq(comments.hiddenAfterRelease, false),
        ne(comments.authorId, users.id),
        or(isNull(comments.parentCommentId), eq(root.hiddenAfterRelease, false)),
        or(
          isNull(comments.sketchContextId),
          and(eq(context.status, "PUBLISHED"), eq(context.hiddenAfterRelease, false)),
        ),
        hasProjectAccessForUser(users.id),
        // Doar detalii PUBLICATE — un detaliu întors în DRAFT nu mai trebuie să tragă digestul (CTA-ul
        // duce la /profile unde activitatea pe ciornă nici nu se vede).
        eq(details.status, "PUBLISHED"),
        // O dezaprobare scrie ȘI un comentariu (cu `originValidationId`) ȘI un rând în `validations` —
        // altfel aceeași acțiune s-ar număra de două ori (aici + `countValidationsOnOwnDetails`).
        // Pe detaliul propriu justificarea este deja numarata ca pozitie. Pentru autorul firului
        // sau schitei de pe detaliul altcuiva ramane un raspuns primit.
        or(isNull(comments.originValidationId), ne(users.id, details.authorId)),
      ),
    )
    .groupBy(users.id);
  return new Map(rows.map((r) => [r.ownerId, Number(r.cnt)]));
}

// Schite primite de autorul detaliului si de autorul parintelui direct, fara dubluri/autonotificare.
export async function countSketchesOnOwnDetails(since: Date): Promise<Map<string, number>> {
  const parent = alias(sketches, "digest_parent");
  const rows = await db
    .select({ ownerId: users.id, cnt: count() })
    .from(sketches)
    .innerJoin(details, eq(sketches.detailId, details.id))
    .leftJoin(
      parent,
      and(
        eq(parent.id, sql`(${sketches.baseSketchIds}->>-1)::uuid`),
        eq(parent.detailId, details.id),
      ),
    )
    .innerJoin(
      users,
      or(
        and(eq(users.id, details.authorId), isNull(details.anonymizedAt)),
        and(
          eq(users.id, parent.authorId),
          eq(parent.authorRemoved, false),
          eq(parent.status, "PUBLISHED"),
          eq(parent.hiddenAfterRelease, false),
        ),
      ),
    )
    .where(
      and(
        gte(sketches.createdAt, since),
        eq(sketches.hiddenAfterRelease, false),
        eq(sketches.status, "PUBLISHED"),
        eq(sketches.isAnnotation, false),
        ne(sketches.authorId, users.id),
        hasProjectAccessForUser(users.id),
        eq(details.status, "PUBLISHED"),
      ),
    )
    .groupBy(users.id);
  return new Map(rows.map((r) => [r.ownerId, Number(r.cnt)]));
}

// Nr. de poziții NOI (de la alții) pe detaliile fiecărui autor.
export async function countValidationsOnOwnDetails(since: Date): Promise<Map<string, number>> {
  const rows = await db
    .select({ ownerId: details.authorId, cnt: count() })
    .from(validations)
    .innerJoin(
      details,
      and(eq(validations.targetType, "DETAIL"), eq(validations.targetId, details.id)),
    )
    .where(
      and(
        gte(validations.createdAt, since),
        eq(validations.hiddenAfterRelease, false),
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
