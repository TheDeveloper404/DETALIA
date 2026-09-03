// Repo comentarii — singurul loc cu acces Drizzle pentru tabelul `comments` (polimorfic Detail/Sketch).
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { commentLikes, comments, roles, users } from "@/db/schema";
import { verifiedCondition } from "@/server/repos/repoHelpers";
import type { TargetType } from "@/server/domain/validation";

// Nr. de aprecieri/dezaprobări pe comentariu — subquery-uri corelate (nu join, ca să nu dublăm rândul
// comentariului). Rămân SEPARATE (nu netate up-down), consecvent cu Aprob/Dezaprob pe validări — vezi
// nota din validation-panel.tsx: greutatea unui vot o judecă cititorul din cine a votat, nu un scor unic.
const upvoteCount = sql<number>`(select count(*)::int from ${commentLikes}
   where ${commentLikes.commentId} = ${comments.id} and ${commentLikes.direction} = 'UP')`;
const downvoteCount = sql<number>`(select count(*)::int from ${commentLikes}
   where ${commentLikes.commentId} = ${comments.id} and ${commentLikes.direction} = 'DOWN')`;

// Lista celor care au apreciat (nume + rol + verificare), cei mai recenți primii — pentru popup-ul
// „vezi cine a apreciat". DOAR up-votes (dezaprobarea pe comentariu rămâne fără listă „cine", ca să nu
// extindem scopul cererii — un simplu contor e suficient). La scara actuală (comunitate mică) e ieftin să
// vină odată cu comentariul, fără fetch separat la deschiderea popup-ului.
const commentLikers = sql<
  { id: string; name: string | null; image: string | null; roleMain: string | null; subRole: string | null; verified: boolean }[]
>`(
  select coalesce(json_agg(json_build_object(
    'id', sub.id, 'name', sub.name, 'image', sub.image,
    'roleMain', sub.role_main, 'subRole', sub.sub_role, 'verified', sub.verified
  )), '[]'::json)
  from (
    select ${users.id} as id, ${users.name} as name, ${users.image} as image,
           ${roles.roleMain} as role_main, ${roles.subRole} as sub_role,
           (${verifiedCondition}) as verified
    from ${commentLikes}
    join ${users} on ${users.id} = ${commentLikes.userId}
    left join ${roles} on ${roles.userId} = ${commentLikes.userId}
    where ${commentLikes.commentId} = ${comments.id} and ${commentLikes.direction} = 'UP'
    order by ${commentLikes.createdAt} desc
  ) sub
)`;

export async function insertComment(input: {
  targetType: TargetType;
  targetId: string;
  authorId: string;
  body: string;
  imageUrl?: string | null;
  originValidationId?: string | null;
  parentCommentId?: string | null;
  replyToCommentId?: string | null;
  sketchContextId?: string | null;
}) {
  const [row] = await db
    .insert(comments)
    .values({
      targetType: input.targetType,
      targetId: input.targetId,
      authorId: input.authorId,
      body: input.body,
      imageUrl: input.imageUrl ?? null,
      originValidationId: input.originValidationId ?? null,
      wasDisapproval: input.originValidationId != null,
      parentCommentId: input.parentCommentId ?? null,
      replyToCommentId: input.replyToCommentId ?? null,
      sketchContextId: input.sketchContextId ?? null,
    })
    .returning();
  return row;
}

// Comentariul pe care s-a apăsat „Răspunde" — poate fi rădăcină SAU un alt reply din același fir
// (aplatizare stil LinkedIn). Întoarce id-ul lui + autorul + rădăcina firului (`rootId` = el însuși
// dacă e rădăcină, altfel `parentCommentId`). Validează apartenența la ACEEAȘI țintă (nu se poate da
// reply peste un comentariu de pe altă pagină). `null` = id inexistent / altă țintă → INVALID_PARENT.
export async function getThreadCommentForTarget(
  id: string,
  targetType: TargetType,
  targetId: string,
): Promise<{ id: string; authorId: string; rootId: string } | null> {
  const [row] = await db
    .select({ id: comments.id, authorId: comments.authorId, parentCommentId: comments.parentCommentId })
    .from(comments)
    .where(
      and(
        eq(comments.id, id),
        eq(comments.targetType, targetType),
        eq(comments.targetId, targetId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { id: row.id, authorId: row.authorId, rootId: row.parentCommentId ?? row.id };
}

// Comentariile unei ținte, cu autor (nume + rol curent). Cronologic (cele vechi sus).
// currentUserId opțional → dacă lipsește, myVote e mereu null (ex. context fără sesiune).
export async function listCommentsForTarget(targetType: TargetType, targetId: string, currentUserId?: string) {
  const myVote = currentUserId
    ? sql<"UP" | "DOWN" | null>`(select ${commentLikes.direction} from ${commentLikes}
        where ${commentLikes.commentId} = ${comments.id} and ${commentLikes.userId} = ${currentUserId} limit 1)`
    : sql<null>`null`;

  // Self-join pt eticheta „↳ către <Nume>": comentariul-țintă concret + autorul lui. Alias, nu subquery
  // corelat (vezi capcana din CLAUDE.md).
  const replyTo = alias(comments, "reply_to");
  const replyToUser = alias(users, "reply_to_user");

  return db
    .select({
      id: comments.id,
      body: comments.body,
      imageUrl: comments.imageUrl,
      createdAt: comments.createdAt,
      originValidationId: comments.originValidationId,
      wasDisapproval: comments.wasDisapproval,
      parentCommentId: comments.parentCommentId,
      replyToCommentId: comments.replyToCommentId,
      replyToAuthorName: replyToUser.name,
      sketchContextId: comments.sketchContextId,
      authorId: comments.authorId,
      authorName: users.name,
      authorImage: users.image,
      authorRoleMain: roles.roleMain,
      authorSubRole: roles.subRole,
      authorVerification: roles.verificationStatus,
      upvoteCount,
      downvoteCount,
      myVote,
      likers: commentLikers,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .leftJoin(roles, eq(roles.userId, comments.authorId))
    .leftJoin(replyTo, eq(replyTo.id, comments.replyToCommentId))
    .leftJoin(replyToUser, eq(replyToUser.id, replyTo.authorId))
    .where(
      and(
        eq(comments.targetType, targetType),
        eq(comments.targetId, targetId),
        // SEC-001 (audit 2026-08-11): comentariu al altui membru, ascuns la „Scoate în comunitate".
        eq(comments.hiddenAfterRelease, false),
      ),
    )
    .orderBy(asc(comments.createdAt));
}

export type TargetComment = Awaited<ReturnType<typeof listCommentsForTarget>>[number];

// Ținta unui comentariu (targetType/targetId) — pentru a deriva detaliul-părinte la editare (validarea
// mențiunilor are nevoie de detailId). Doar coloanele minime, fără join.
export async function getCommentTarget(
  id: string,
): Promise<{ targetType: TargetType; targetId: string; authorId: string } | null> {
  const [row] = await db
    .select({
      targetType: comments.targetType,
      targetId: comments.targetId,
      authorId: comments.authorId,
    })
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1);
  return row ?? null;
}

// Editează corpul unui comentariu — DOAR al autorului (condiție pe authorId → fără IDOR). True dacă a actualizat.
export async function updateCommentByAuthor(id: string, authorId: string, body: string): Promise<boolean> {
  const rows = await db
    .update(comments)
    .set({ body })
    .where(and(eq(comments.id, id), eq(comments.authorId, authorId)))
    .returning({ id: comments.id });
  return rows.length > 0;
}

// Șterge un comentariu — DOAR al autorului ȘI doar comentariu LIBER (originValidationId null).
// Justificările de dezaprobare nu se șterg singure (ar deveni „dezaprobare mută"). True dacă a șters.
// Întoarce `imageUrl` al rândului șters (sau null) ca serviciul să poată curăța fișierul din Blob —
// fără asta, fiecare comentariu șters cu poză lăsa un orfan în storage, plătit la nesfârșit.
export async function deleteFreeCommentByAuthor(
  id: string,
  authorId: string,
): Promise<{ deleted: boolean; imageUrl: string | null }> {
  const rows = await db
    .delete(comments)
    .where(and(eq(comments.id, id), eq(comments.authorId, authorId), isNull(comments.originValidationId)))
    .returning({ id: comments.id, imageUrl: comments.imageUrl });
  return { deleted: rows.length > 0, imageUrl: rows[0]?.imageUrl ?? null };
}

// Toggle vot pe comentariu — o singură poziție per user per comentariu: același sens din nou → retrage
// (delete), sens opus → comută (update direction), nicio poziție încă → adaugă (insert). Ownership
// („nu-ți poți vota propriul comentariu") se verifică în service, nu aici. Întoarce direcția rezultată
// sau null dacă poziția a fost retrasă.
export async function toggleCommentLike(
  commentId: string,
  userId: string,
  direction: "UP" | "DOWN",
): Promise<"UP" | "DOWN" | null> {
  const [existing] = await db
    .select({ direction: commentLikes.direction })
    .from(commentLikes)
    .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)))
    .limit(1);

  if (existing?.direction === direction) {
    await db
      .delete(commentLikes)
      .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)));
    return null;
  }

  await db
    .insert(commentLikes)
    .values({ commentId, userId, direction })
    .onConflictDoUpdate({ target: [commentLikes.userId, commentLikes.commentId], set: { direction } });
  return direction;
}
