// Repo comentarii — singurul loc cu acces Drizzle pentru tabelul `comments` (polimorfic Detail/Sketch).
import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { comments, roles, users } from "@/db/schema";
import type { TargetType } from "@/server/domain/validation";

export async function insertComment(input: {
  targetType: TargetType;
  targetId: string;
  authorId: string;
  body: string;
  originValidationId?: string | null;
}) {
  const [row] = await db
    .insert(comments)
    .values({
      targetType: input.targetType,
      targetId: input.targetId,
      authorId: input.authorId,
      body: input.body,
      originValidationId: input.originValidationId ?? null,
    })
    .returning();
  return row;
}

// Comentariile unei ținte, cu autor (nume + rol curent). Cronologic (cele vechi sus).
export async function listCommentsForTarget(targetType: TargetType, targetId: string) {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      originValidationId: comments.originValidationId,
      authorId: comments.authorId,
      authorName: users.name,
      authorImage: users.image,
      authorRoleMain: roles.roleMain,
      authorSubRole: roles.subRole,
      authorVerification: roles.verificationStatus,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .leftJoin(roles, eq(roles.userId, comments.authorId))
    .where(and(eq(comments.targetType, targetType), eq(comments.targetId, targetId)))
    .orderBy(asc(comments.createdAt));
}

export type TargetComment = Awaited<ReturnType<typeof listCommentsForTarget>>[number];

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
