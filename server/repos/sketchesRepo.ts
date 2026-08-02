// Repo schițe — singurul loc cu acces Drizzle pentru tabelul `sketches`.
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

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

// `note` opțional: undefined = nu se atinge coloana (autosave-uri vechi/apeluri fără notă nu o șterg).
export async function updateStrokes(id: string, strokesJson: Stroke[], note?: string | null) {
  const set: { strokesJson: Stroke[]; note?: string | null } = { strokesJson };
  if (note !== undefined) set.note = note;
  await db.update(sketches).set(set).where(eq(sketches.id, id));
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
  note: sketches.note,
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
    .innerJoin(details, eq(details.id, sketches.detailId))
    .leftJoin(users, eq(users.id, sketches.authorId))
    .leftJoin(roles, eq(roles.userId, sketches.authorId))
    .where(
      and(
        eq(sketches.detailId, detailId),
        eq(sketches.status, status),
        // Exclude ADNOTAREA autorului (schiță pe propriul detaliu) — vezi `isSelfAnnotation`
        // (server/domain/sketch.ts). Teancul = contribuțiile ALTORA, model fork/PR.
        ne(sketches.authorId, details.authorId),
      ),
    )
    .orderBy(desc(sketches.createdAt));
}

// Teancul = schițele PUBLISHED ale unui detaliu, ALE ALTOR USERI (navigabile prin taburi).
// Adnotările autorului pe propriul detaliu NU sunt aici — vezi `listAnnotationsByDetail`.
export function listPublishedByDetail(detailId: string) {
  return listByDetailAndStatus(detailId, "PUBLISHED");
}

// ADNOTĂRILE autorului: schițele PUBLISHED făcute de autorul detaliului pe PROPRIUL lui detaliu.
// Se afișează peste imaginea de bază (una câte una, la cerere), nu ca taburi în teanc. Un detaliu poate
// avea până la MAX_ANNOTATIONS_PER_DETAIL (domain/sketch.ts) — decizie 2026-08-02, înainte era una singură.
// ORDINE ASCENDENTĂ după `created_at`: numerotarea din UI („adnotarea 1/2/3") urmează ordinea în care
// autorul le-a desenat. ATENȚIE: e o POZIȚIE în listă, nu un ordinal persistat — la ștergerea uneia din
// mijloc, cele de după se renumerotează. Un ordinal stabil ar cere o coloană dedicată (vezi CHANGELOG
// 2026-08-02); acceptat conștient, adnotările nu sunt referite după număr nicăieri (nu sunt @mention-abile).
export async function listAnnotationsByDetail(detailId: string) {
  return db
    .select({
      id: sketches.id,
      strokesJson: sketches.strokesJson,
      note: sketches.note,
      createdAt: sketches.createdAt,
      authorId: sketches.authorId,
    })
    .from(sketches)
    .innerJoin(details, eq(details.id, sketches.detailId))
    .where(
      and(
        eq(sketches.detailId, detailId),
        eq(sketches.status, "PUBLISHED"),
        eq(sketches.authorId, details.authorId),
      ),
    )
    .orderBy(asc(sketches.createdAt));
}

// Câte adnotări PUBLISHED are detaliul — pentru plafonul impus în `publish`. Numărat în DB, nu prin
// `listAnnotationsByDetail(...).length`: la verificarea plafonului nu ne trebuie payload-ul de stroke-uri.
export async function countAnnotationsByDetail(detailId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sketches)
    .innerJoin(details, eq(details.id, sketches.detailId))
    .where(
      and(
        eq(sketches.detailId, detailId),
        eq(sketches.status, "PUBLISHED"),
        eq(sketches.authorId, details.authorId),
      ),
    );
  return row?.count ?? 0;
}

// Filtrează, dintr-un set de id-uri candidate, doar pe cele care sunt schițe PUBLISHED ale acestui
// detaliu. Folosit la validarea mențiunilor @schiță din comentarii (anti-IDOR: nu poți referi o schiță
// din alt detaliu / inexistentă). Întoarce un Set pentru lookup O(1) în sanitizarea corpului.
export async function filterSketchIdsByDetail(
  detailId: string,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: sketches.id })
    .from(sketches)
    .where(
      and(
        eq(sketches.detailId, detailId),
        eq(sketches.status, "PUBLISHED"),
        inArray(sketches.id, ids),
      ),
    );
  return new Set(rows.map((r) => r.id));
}


// Teaser PUBLIC (fără autentificare) al unei schițe — DOAR PUBLISHED (draft-urile nu sunt niciodată
// accesibile fără cont). Randăm `thumbnailUrl` (imaginea deja compusă la publicare: detaliul-mamă +
// stroke-urile suprapuse) — read-only, fără strokesJson (nu expunem datele vectoriale unui vizitator
// anonim, doar rezultatul randat).
export async function getPublicSketchTeaser(id: string) {
  const [row] = await db
    .select({
      id: sketches.id,
      thumbnailUrl: sketches.thumbnailUrl,
      acceptedAt: sketches.acceptedAt,
      detailId: sketches.detailId,
      detailTitle: details.title,
      authorName: users.name,
      authorRoleMain: roles.roleMain,
      authorSubRole: roles.subRole,
      authorVerification: roles.verificationStatus,
    })
    .from(sketches)
    .innerJoin(details, eq(details.id, sketches.detailId))
    .leftJoin(users, eq(users.id, sketches.authorId))
    .leftJoin(roles, eq(roles.userId, sketches.authorId))
    .where(and(eq(sketches.id, id), eq(sketches.status, "PUBLISHED")))
    .limit(1);
  return row ?? null;
}

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

// Șterge o ciornă — DOAR a autorului ei și DOAR cât e DRAFT (delete condiționat). Întoarce true dacă a șters.
export async function deleteDraftByAuthor(id: string, authorId: string): Promise<boolean> {
  const rows = await db
    .delete(sketches)
    .where(and(eq(sketches.id, id), eq(sketches.authorId, authorId), eq(sketches.status, "DRAFT")))
    .returning({ id: sketches.id });
  return rows.length > 0;
}
