// Repo comentarii — singurul loc cu acces Drizzle pentru tabelul `comments` (polimorfic Detail/Sketch).
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { commentLikes, comments, roles, users } from "@/db/schema";
import type { TargetType } from "@/server/domain/validation";

// Nr. de aprecieri pe comentariu — subquery corelat (nu join, ca să nu dublăm rândul comentariului).
const likeCount = sql<number>`(select count(*)::int from ${commentLikes}
   where ${commentLikes.commentId} = ${comments.id})`;

// Lista celor care au apreciat (nume + rol + verificare), cei mai recenți primii — pentru popup-ul
// „vezi cine a apreciat". La scara MVP (comunitate mică) e ieftin să vină odată cu comentariul, fără
// fetch separat la deschiderea popup-ului.
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
           (${roles.verificationStatus} = 'VERIFIED') as verified
    from ${commentLikes}
    join ${users} on ${users.id} = ${commentLikes.userId}
    left join ${roles} on ${roles.userId} = ${commentLikes.userId}
    where ${commentLikes.commentId} = ${comments.id}
    order by ${commentLikes.createdAt} desc
  ) sub
)`;

export async function insertComment(input: {
  targetType: TargetType;
  targetId: string;
  authorId: string;
  body: string;
  originValidationId?: string | null;
  parentCommentId?: string | null;
  sketchContextId?: string | null;
}) {
  const [row] = await db
    .insert(comments)
    .values({
      targetType: input.targetType,
      targetId: input.targetId,
      authorId: input.authorId,
      body: input.body,
      originValidationId: input.originValidationId ?? null,
      wasDisapproval: input.originValidationId != null,
      parentCommentId: input.parentCommentId ?? null,
      sketchContextId: input.sketchContextId ?? null,
    })
    .returning();
  return row;
}

// Comentariul-părinte la care se dă reply — validează că e RĂDĂCINĂ (parentCommentId null, „un singur
// nivel") ȘI că aparține aceleiași ținte (nu poți da reply peste un comentariu de pe altă pagină).
export async function getRootCommentForTarget(
  id: string,
  targetType: TargetType,
  targetId: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: comments.id })
    .from(comments)
    .where(
      and(
        eq(comments.id, id),
        eq(comments.targetType, targetType),
        eq(comments.targetId, targetId),
        isNull(comments.parentCommentId),
      ),
    )
    .limit(1);
  return row ?? null;
}

// Comentariile unei ținte, cu autor (nume + rol curent). Cronologic (cele vechi sus).
// currentUserId opțional → dacă lipsește, likedByMe e mereu false (ex. context fără sesiune).
export async function listCommentsForTarget(targetType: TargetType, targetId: string, currentUserId?: string) {
  const likedByMe = currentUserId
    ? sql<boolean>`exists (select 1 from ${commentLikes}
        where ${commentLikes.commentId} = ${comments.id} and ${commentLikes.userId} = ${currentUserId})`
    : sql<boolean>`false`;

  return db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      originValidationId: comments.originValidationId,
      wasDisapproval: comments.wasDisapproval,
      parentCommentId: comments.parentCommentId,
      sketchContextId: comments.sketchContextId,
      authorId: comments.authorId,
      authorName: users.name,
      authorImage: users.image,
      authorRoleMain: roles.roleMain,
      authorSubRole: roles.subRole,
      authorVerification: roles.verificationStatus,
      likeCount,
      likedByMe,
      likers: commentLikers,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .leftJoin(roles, eq(roles.userId, comments.authorId))
    .where(and(eq(comments.targetType, targetType), eq(comments.targetId, targetId)))
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
export async function deleteFreeCommentByAuthor(id: string, authorId: string): Promise<boolean> {
  const rows = await db
    .delete(comments)
    .where(and(eq(comments.id, id), eq(comments.authorId, authorId), isNull(comments.originValidationId)))
    .returning({ id: comments.id });
  return rows.length > 0;
}

// Toggle like pe comentariu — o singură poziție per user per comentariu, reversibilă (delete dacă
// exista, altfel insert). Ownership („nu-ți poți aprecia propriul comentariu") se verifică în service,
// nu aici. Întoarce true = acum e apreciat, false = tocmai a fost retras.
export async function toggleCommentLike(commentId: string, userId: string): Promise<boolean> {
  const deleted = await db
    .delete(commentLikes)
    .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)))
    .returning({ commentId: commentLikes.commentId });
  if (deleted.length > 0) return false;

  await db.insert(commentLikes).values({ commentId, userId }).onConflictDoNothing();
  return true;
}
