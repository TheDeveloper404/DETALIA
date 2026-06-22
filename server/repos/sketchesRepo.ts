// Repo schițe — singurul loc cu acces Drizzle pentru tabelul `sketches`.
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { roles, sketches, users } from "@/db/schema";
import { type SketchStatus, type Stroke } from "@/server/domain/sketch";

export async function insertDraft(input: {
  detailId: string;
  authorId: string;
  strokesJson: Stroke[] | null;
}) {
  const [row] = await db
    .insert(sketches)
    .values({
      detailId: input.detailId,
      authorId: input.authorId,
      strokesJson: input.strokesJson,
      // status rămâne pe default „DRAFT".
    })
    .returning();
  return row;
}

export async function getSketchById(id: string) {
  const [row] = await db.select().from(sketches).where(eq(sketches.id, id)).limit(1);
  return row ?? null;
}

export async function updateStrokes(id: string, strokesJson: Stroke[]) {
  await db.update(sketches).set({ strokesJson }).where(eq(sketches.id, id));
}

export async function updateStatus(
  id: string,
  input: { status: SketchStatus; thumbnailUrl?: string | null; acceptedAt?: Date | null },
) {
  await db
    .update(sketches)
    .set({
      status: input.status,
      ...(input.thumbnailUrl !== undefined ? { thumbnailUrl: input.thumbnailUrl } : {}),
      ...(input.acceptedAt !== undefined ? { acceptedAt: input.acceptedAt } : {}),
    })
    .where(eq(sketches.id, id));
}

// Forma de afișare a unei schițe cu autor (nume+rol) + stroke-uri (pt randare în pagină).
// Teancul/coada sunt mici (câteva foi) → e ok să aducem strokesJson aici.
const sketchWithAuthorColumns = {
  id: sketches.id,
  status: sketches.status,
  thumbnailUrl: sketches.thumbnailUrl,
  strokesJson: sketches.strokesJson,
  createdAt: sketches.createdAt,
  detailId: sketches.detailId,
  authorId: sketches.authorId,
  authorName: users.name,
  authorImage: users.image,
  authorRoleMain: roles.roleMain,
  authorSubRole: roles.subRole,
  authorVerification: roles.verificationStatus,
} as const;

function listByDetailAndStatus(detailId: string, status: SketchStatus) {
  return db
    .select(sketchWithAuthorColumns)
    .from(sketches)
    .leftJoin(users, eq(users.id, sketches.authorId))
    .leftJoin(roles, eq(roles.userId, sketches.authorId))
    .where(and(eq(sketches.detailId, detailId), eq(sketches.status, status)))
    .orderBy(desc(sketches.createdAt));
}

// Teancul = schițele PUBLISHED ale unui detaliu (navigabile prin taburi).
export function listPublishedByDetail(detailId: string) {
  return listByDetailAndStatus(detailId, "PUBLISHED");
}

// Coada de review a autorului-mamă = schițele PENDING_ACCEPTANCE.
export function listPendingByDetail(detailId: string) {
  return listByDetailAndStatus(detailId, "PENDING_ACCEPTANCE");
}

export type SketchWithAuthor = Awaited<ReturnType<typeof listPublishedByDetail>>[number];
