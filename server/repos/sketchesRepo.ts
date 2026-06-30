// Repo schițe — singurul loc cu acces Drizzle pentru tabelul `sketches`.
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { comments, details, roles, sketches, users, validations } from "@/db/schema";
import { type SketchStatus, type Stroke } from "@/server/domain/sketch";

export async function insertDraft(input: {
  detailId: string;
  authorId: string;
  strokesJson: Stroke[] | null;
  disapprovesParent?: boolean;
}) {
  const [row] = await db
    .insert(sketches)
    .values({
      detailId: input.detailId,
      authorId: input.authorId,
      strokesJson: input.strokesJson,
      disapprovesParent: input.disapprovesParent ?? false,
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

// Tranziție condiționată DRAFT → PUBLISHED (PUBLISH direct, fără coadă de acceptare). Guard atomic pe
// status + autor: două PUBLISH concurente nu pot notifica ambele — doar primul prinde rândul în DRAFT.
// Întoarce true dacă a tranziționat. `acceptedAt` = momentul publicării (nume moștenit din fluxul vechi).
export async function publishFromDraft(
  id: string,
  authorId: string,
  input: { thumbnailUrl: string | null; publishedAt: Date },
): Promise<boolean> {
  const rows = await db
    .update(sketches)
    .set({ status: "PUBLISHED", thumbnailUrl: input.thumbnailUrl, acceptedAt: input.publishedAt })
    .where(and(eq(sketches.id, id), eq(sketches.authorId, authorId), eq(sketches.status, "DRAFT")))
    .returning({ id: sketches.id });
  return rows.length > 0;
}

// Șterge o schiță + interacțiunile ei (validări + comentarii polimorfice pe SKETCH), ATOMIC. Validările și
// comentariile nu au FK către sketches (polimorfice target_type/target_id) → se șterg manual, în batch.
// Ownership-ul îl verifică serviciul ÎNAINTE. Întoarce thumbnailUrl (pt curățarea blob best-effort din service).
export async function deleteSketchCascade(id: string): Promise<string | null> {
  const sketch = await getSketchById(id);
  if (!sketch) return null;
  await db.batch([
    db
      .delete(validations)
      .where(and(eq(validations.targetType, "SKETCH"), eq(validations.targetId, id))),
    db.delete(comments).where(and(eq(comments.targetType, "SKETCH"), eq(comments.targetId, id))),
    db.delete(sketches).where(eq(sketches.id, id)),
  ]);
  return sketch.thumbnailUrl ?? null;
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

export type SketchWithAuthor = Awaited<ReturnType<typeof listPublishedByDetail>>[number];

// Cele mai recente schițe PUBLISHED din toată platforma (pentru rail-ul feed-ului „Schițe noi în teanc").
// Doar metadate de afișare (fără strokesJson) — randăm thumbnail-ul deja generat la publicare.
export function listRecentPublished(limit: number) {
  return db
    .select({
      id: sketches.id,
      detailId: sketches.detailId,
      thumbnailUrl: sketches.thumbnailUrl,
      acceptedAt: sketches.acceptedAt,
      detailTitle: details.title,
      authorName: users.name,
      authorImage: users.image,
      authorRoleMain: roles.roleMain,
      authorVerification: roles.verificationStatus,
    })
    .from(sketches)
    .innerJoin(details, eq(details.id, sketches.detailId))
    .leftJoin(users, eq(users.id, sketches.authorId))
    .leftJoin(roles, eq(roles.userId, sketches.authorId))
    .where(eq(sketches.status, "PUBLISHED"))
    .orderBy(desc(sketches.acceptedAt))
    .limit(limit);
}

export type RecentPublishedSketch = Awaited<ReturnType<typeof listRecentPublished>>[number];

// Ciornele (DRAFT) ale unui autor — cu titlul + imaginea detaliului-mamă, pentru a le relua din „Ciornele mele".
export function listDraftsByAuthor(authorId: string) {
  return db
    .select({
      id: sketches.id,
      createdAt: sketches.createdAt,
      detailId: sketches.detailId,
      detailTitle: details.title,
      detailImageUrl: details.imageUrl,
    })
    .from(sketches)
    .innerJoin(details, eq(details.id, sketches.detailId))
    .where(and(eq(sketches.authorId, authorId), eq(sketches.status, "DRAFT")))
    .orderBy(desc(sketches.createdAt));
}

export type DraftItem = Awaited<ReturnType<typeof listDraftsByAuthor>>[number];

// Șterge o ciornă — DOAR a autorului ei și DOAR cât e DRAFT (delete condiționat). Întoarce true dacă a șters.
export async function deleteDraftByAuthor(id: string, authorId: string): Promise<boolean> {
  const rows = await db
    .delete(sketches)
    .where(and(eq(sketches.id, id), eq(sketches.authorId, authorId), eq(sketches.status, "DRAFT")))
    .returning({ id: sketches.id });
  return rows.length > 0;
}
