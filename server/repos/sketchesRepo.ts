// Repo schițe — singurul loc cu acces Drizzle pentru tabelul `sketches`.
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { comments, details, roles, sketches, users, validations } from "@/db/schema";
import { type SketchStatus, type Stroke } from "@/server/domain/sketch";
import type { RoleSnapshot } from "@/server/domain/validation";

export async function insertDraft(input: {
  detailId: string;
  authorId: string;
  strokesJson: Stroke[] | null;
  disapprovesParent?: boolean;
  // Rețeta stack-ului înghețat la apăsarea „Schițează peste". Gol = pornită de pe detaliul gol.
  baseSketchIds?: string[];
}) {
  const [row] = await db
    .insert(sketches)
    .values({
      detailId: input.detailId,
      authorId: input.authorId,
      strokesJson: input.strokesJson,
      disapprovesParent: input.disapprovesParent ?? false,
      // Lista goală se stochează ca NULL, nu ca `[]`: o singură reprezentare pentru „fără fundal",
      // aceeași cu a schițelor de dinaintea feature-ului. Altfel ar exista două forme de „gol".
      baseSketchIds: input.baseSketchIds?.length ? input.baseSketchIds : null,
      // status rămâne pe default „DRAFT".
    })
    .returning();
  return row;
}

// Din `ids`, care mai există ACUM ca schițe PUBLISHED pe acest detaliu — în ORDINEA cerută de apelant
// (Postgres nu garantează ordinea unui `IN`, iar ordinea e chiar semantica stack-ului: jos → sus).
// Folosit în două locuri: la creare (validarea rețetei primite din client) și la publicare (curățarea
// foilor dispărute între timp).
export async function filterPublishedSketchIds(detailId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: sketches.id })
    .from(sketches)
    .innerJoin(details, eq(details.id, sketches.detailId))
    .where(
      and(
        inArray(sketches.id, ids),
        eq(sketches.detailId, detailId),
        eq(sketches.status, "PUBLISHED"),
        // Aceeași excludere ca în `listByDetailAndStatus`: ADNOTĂRILE autorului nu sunt foi din teanc.
        // Fără ea, un id de adnotare ar trece validarea și s-ar bloca la publicare, dar UI-ul nu l-ar
        // găsi niciodată în teanc → foaie acceptată de server, imposibil de randat.
        ne(sketches.authorId, details.authorId),
      ),
    );
  const alive = new Set(rows.map((r) => r.id));
  return ids.filter((id) => alive.has(id));
}

// Blochează definitiv foile folosite ca fundal de o schiță tocmai publicată: din acest moment nu mai
// pot fi șterse complet, doar li se poate retrage identitatea autorului (vezi `deleteSketch`).
// `isNull(lockedAt)` face operația idempotentă și păstrează PRIMA blocare — momentul în care foaia a
// intrat efectiv într-o dezbatere, nu al ultimei schițe construite peste ea.
export async function lockStackBases(ids: string[], at: Date): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(sketches)
    .set({ lockedAt: at })
    .where(and(inArray(sketches.id, ids), isNull(sketches.lockedAt)));
}

// ȘTERGERE PARȚIALĂ: retrage IDENTITATEA autorului, păstrează contribuția. `strokes_json`,
// `role_snapshot`, `thumbnail_url` și `note` rămân neatinse — desenul e parte dintr-o dezbatere pe care
// alții au continuat-o. Nu se atinge nici `base_sketch_ids`/`locked_at` proprii: foaia rămâne exact
// unde e în teancurile altora. Idempotentă (a doua apelare nu schimbă nimic).
export async function markAuthorRemoved(id: string): Promise<void> {
  await db.update(sketches).set({ authorRemoved: true }).where(eq(sketches.id, id));
}

// Rescrie rețeta stack-ului (la publicare, după eliminarea foilor dispărute între timp).
export async function updateBaseSketchIds(id: string, ids: string[]): Promise<void> {
  await db
    .update(sketches)
    .set({ baseSketchIds: ids.length ? ids : null })
    .where(eq(sketches.id, id));
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
  input: {
    thumbnailUrl: string | null;
    publishedAt: Date;
    // Rolul autorului ÎNGHEȚAT acum, nu la ștergere: dacă îl capturăm abia când identitatea se retrage,
    // schițele publicate înainte de a exista regula rămân fără rol de afișat.
    roleSnapshot: RoleSnapshot | null;
  },
): Promise<boolean> {
  const rows = await db
    .update(sketches)
    .set({
      status: "PUBLISHED",
      thumbnailUrl: input.thumbnailUrl,
      acceptedAt: input.publishedAt,
      roleSnapshot: input.roleSnapshot,
    })
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
  // Rețeta stack-ului: UI-ul o folosește ca să știe ce foi să aprindă implicit sub schița activă.
  baseSketchIds: sketches.baseSketchIds,
  // Identitate retrasă (ștergere parțială): UI-ul afișează „Autor șters · rol" în locul autorului real.
  // `roleSnapshot` = rolul ÎNGHEȚAT la publicare, nu cel curent — contează cine era când a desenat.
  authorRemoved: sketches.authorRemoved,
  roleSnapshot: sketches.roleSnapshot,
  // Foaie intrată într-o dezbatere (cineva a construit peste ea) → nu mai poate fi ștearsă complet.
  lockedAt: sketches.lockedAt,
  authorName: users.name,
  authorImage: users.image,
  authorRoleMain: roles.roleMain,
  authorSubRole: roles.subRole,
  authorVerification: roles.verificationStatus,
} as const;

type SketchWithAuthorRow = Awaited<ReturnType<typeof selectByDetailAndStatus>>[number];

function selectByDetailAndStatus(detailId: string, status: SketchStatus) {
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

// Mascarea identității pe foile cu ștergere PARȚIALĂ, aplicată AICI — în repo, singura poartă prin care
// datele ies spre UI. Dacă am lăsa fiecare renderer să decidă (tab, avatar, listă de @mention, panou de
// validare), ar fi de-ajuns unul uitat ca numele real să reapară exact acolo unde userul a cerut să nu
// mai fie. `authorId` se maschează și el: altfel link-ul către profil rămâne, chiar fără nume afișat.
//
// Rolul rămâne vizibil, dar din `roleSnapshot` (înghețat la publicare) — contează cine era când a
// desenat, nu ce rol are azi. Vezi REMOVED_AUTHOR_LABEL în server/domain/sketch.ts.
function maskRemovedAuthor(row: SketchWithAuthorRow): SketchWithAuthorRow {
  if (!row.authorRemoved) return row;
  const snap = row.roleSnapshot as RoleSnapshot | null;
  return {
    ...row,
    authorId: "",
    authorName: null,
    authorImage: null,
    // `RoleSnapshot` stochează string-uri libere (jsonb istoric), coloanele sunt enum-uri — cast
    // explicit la forma rândului. Snapshot-ul a fost scris din aceleași enum-uri, la publicare.
    authorRoleMain: (snap?.roleMain ?? null) as SketchWithAuthorRow["authorRoleMain"],
    authorSubRole: snap?.subRole ?? null,
    authorVerification: (snap?.verificationStatus ??
      null) as SketchWithAuthorRow["authorVerification"],
  };
}

async function listByDetailAndStatus(detailId: string, status: SketchStatus) {
  const rows = await selectByDetailAndStatus(detailId, status);
  return rows.map(maskRemovedAuthor);
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
      authorRemoved: sketches.authorRemoved,
      roleSnapshot: sketches.roleSnapshot,
    })
    .from(sketches)
    .innerJoin(details, eq(details.id, sketches.detailId))
    .leftJoin(users, eq(users.id, sketches.authorId))
    .leftJoin(roles, eq(roles.userId, sketches.authorId))
    .where(
      and(
        eq(sketches.id, id),
        eq(sketches.status, "PUBLISHED"),
        // Proiecte (2026-08-09): `/s/[id]` e PUBLIC, fără cont — o schiță pe un detaliu de proiect nu
        // trebuie să apară aici NICIODATĂ, indiferent de viewer (nici măcar membrii proiectului; ei o
        // văd pe pagina proiectului, nu pe teaser-ul public).
        isNull(details.projectId),
      ),
    )
    .limit(1);
  if (!row) return null;

  // Mascare și AICI, nu doar în teanc: `/s/[id]` e pagina publică de share, singura suprafață
  // accesibilă FĂRĂ CONT — și intră în metadata OG, deci ajunge indexată. O identitate retrasă care
  // supraviețuiește aici e fix opusul a ce a cerut userul, pe cea mai vizibilă pagină cu putință.
  if (!row.authorRemoved) return row;
  const snap = row.roleSnapshot as RoleSnapshot | null;
  return {
    ...row,
    authorName: null,
    authorRoleMain: (snap?.roleMain ?? null) as typeof row.authorRoleMain,
    authorSubRole: snap?.subRole ?? null,
    authorVerification: (snap?.verificationStatus ?? null) as typeof row.authorVerification,
  };
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
