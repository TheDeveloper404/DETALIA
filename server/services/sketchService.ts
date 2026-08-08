// Service Schiță — state machine + authz (CRITICAL). Enforce pe SERVER (simplificat 2026-06-30):
//  - Doar AUTORUL schiței editează/publică; ștergerea o poate face autorul schiței SAU autorul detaliului-mamă.
//  - DRAFT ─publish→ PUBLISHED (direct, fără coadă). Moderare post-publicare prin ștergere.
//  - Un singur autor pe foaie. Stroke-uri normalizate 0..1, validate.
//  - actorUserId vine ÎNTOTDEAUNA din sesiune (apelantul) — fără IDOR.

import { deleteBlobs } from "@/lib/storage";
import { isUuid } from "@/server/domain/ids";
import {
  canAddAnnotation,
  isSelfAnnotation,
  resolveSketchDeletionMode,
  SKETCH_STATUS,
  type Stroke,
  validateBaseSketchIds,
  validateSketchNote,
  validateStrokes,
} from "@/server/domain/sketch";
import { getDetailById } from "@/server/repos/detailsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import {
  getSketchById,
  insertDraft,
  countAnnotationsByDetail,
  deleteDraftByAuthor,
  deleteSketchCascade,
  filterPublishedSketchIds,
  getPublicSketchTeaser,
  lockStackBases,
  markAuthorRemoved,
  updateBaseSketchIds,
  listAnnotationsByDetail,
  listDraftsByAuthor,
  listPublishedByDetail,
  publishFromDraft,
  updateStrokes,
} from "@/server/repos/sketchesRepo";
import { snapshotFromRole } from "@/server/domain/validation";
import { getNotificationActor } from "@/server/repos/usersRepo";
import { notifySketchDeleted, notifySketchProposed } from "@/server/services/notificationService";
import { recordSketchDisapproval } from "@/server/services/validationService";

type SketchError =
  | "NO_ROLE"
  | "DETAIL_NOT_FOUND"
  | "SKETCH_NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "EMPTY_STROKES"
  | "INVALID_STROKES"
  | "NOTE_TOO_LONG"
  | "ANNOTATION_LIMIT"
  | "INVALID_STACK"
  | "STACK_TOO_DEEP"
  // Foaie intrată într-o dezbatere (alții au construit peste ea): nu mai poate fi ștearsă. Distinct de
  // FORBIDDEN — actorul ARE dreptul de moderare, dar regula stack-ului primează. UI-ul explică de ce.
  | "SKETCH_LOCKED";

export type SketchResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; value: T })
  | { ok: false; error: SketchError };

// Creează o foaie nouă (DRAFT) peste un detaliu. Se ajunge din „Schițează peste detaliu" (contribuție
// neutră) SAU din fereastra de Dezaprob → „fă o schiță" (`disapprovesParent: true` → la publicare se
// materializează automat o dezaprobare pe detaliul-mamă, vezi `publish`).
export async function createDraft(input: {
  detailId: string;
  authorId: string;
  disapprovesParent?: boolean;
  // Foile aprinse pe ecran în momentul apăsării — devin fundalul înghețat al noii schițe.
  baseSketchIds?: unknown;
}): Promise<SketchResult<{ sketchId: string }>> {
  if (!isUuid(input.detailId)) return { ok: false, error: "DETAIL_NOT_FOUND" }; // SEC-11
  if (!(await getRoleByUserId(input.authorId))) return { ok: false, error: "NO_ROLE" };
  const detail = await getDetailById(input.detailId);
  if (!detail) return { ok: false, error: "DETAIL_NOT_FOUND" };

  // Rețeta stack-ului vine din CLIENT → validată structural (domain), apoi confruntată cu DB-ul:
  // id-urile trebuie să fie schițe PUBLISHED de pe ACEST detaliu. Fără verificarea de apartenență,
  // cineva ar putea trimite id-uri de pe alt detaliu și randa conținut străin peste imaginea asta.
  const stackValidation = validateBaseSketchIds(input.baseSketchIds);
  if (!stackValidation.ok) return { ok: false, error: stackValidation.error };
  const baseSketchIds = stackValidation.value.length
    ? await filterPublishedSketchIds(input.detailId, stackValidation.value)
    : [];

  // AUTORUL pe PROPRIUL detaliu: „Schițează peste" înseamnă o ADNOTARE NOUĂ, pornită de la zero
  // (decizie de produs 2026-08-02). Adnotările existente rămân neatinse — se corectează prin ȘTERGERE +
  // desenare din nou, nu prin editare. Plafonul se verifică și AICI ca să nu deschidem un editor în
  // care userul desenează degeaba; `publish` îl reverifică oricum și el e sursa de adevăr.
  // (Între 2026-07-31 și 2026-08-01 draftul pornea din adnotarea curentă, iar publicarea o înlocuia.)
  const selfAnnotation = isSelfAnnotation({
    sketchAuthorId: input.authorId,
    detailAuthorId: detail.ownerId,
  });
  if (selfAnnotation) {
    const count = await countAnnotationsByDetail(input.detailId);
    if (!canAddAnnotation(count)) return { ok: false, error: "ANNOTATION_LIMIT" };
  }

  const sketch = await insertDraft({
    detailId: input.detailId,
    authorId: input.authorId,
    strokesJson: null,
    disapprovesParent: input.disapprovesParent ?? false,
    // ADNOTAREA autorului pornește MEREU de la detaliul gol, chiar dacă a fost declanșată dintr-un tab
    // cu stack aprins (decizie de produs 2026-08-08): o adnotare e nota autorului pe imaginea LUI, nu
    // un răspuns într-o dezbatere. Un răspuns în dezbatere e o schiță normală, ca a oricui altcuiva.
    baseSketchIds: selfAnnotation ? [] : baseSketchIds,
  });
  return { ok: true, value: { sketchId: sketch.id } };
}

// Salvează stroke-urile (autosave) — doar autorul, doar cât e DRAFT. `note` opțional (undefined = nu se
// atinge) — explicația autorului, SEPARATĂ de desen (2026-07-16).
export async function saveStrokes(input: {
  sketchId: string;
  authorId: string;
  strokes: unknown;
  note?: unknown;
}): Promise<SketchResult> {
  if (!isUuid(input.sketchId)) return { ok: false, error: "SKETCH_NOT_FOUND" }; // SEC-11
  const sketch = await getSketchById(input.sketchId);
  if (!sketch) return { ok: false, error: "SKETCH_NOT_FOUND" };
  if (sketch.authorId !== input.authorId) return { ok: false, error: "FORBIDDEN" };
  if (sketch.status !== SKETCH_STATUS.DRAFT) return { ok: false, error: "INVALID_STATE" };

  const validation = validateStrokes(input.strokes);
  if (!validation.ok) {
    return { ok: false, error: validation.error === "EMPTY" ? "EMPTY_STROKES" : "INVALID_STROKES" };
  }
  let note: string | null | undefined;
  if (input.note !== undefined) {
    const noteValidation = validateSketchNote(input.note);
    if (!noteValidation.ok) return { ok: false, error: "NOTE_TOO_LONG" };
    note = noteValidation.value;
  }
  await updateStrokes(input.sketchId, validation.value, note);
  return { ok: true };
}

// PUBLISH: DRAFT → PUBLISHED (autor schiță). Intră DIRECT în teanc (fără coadă de acceptare). Notifică
// autorul detaliului-mamă (in-app + email). thumbnailUrl = PNG randat client-side (schița peste imaginea-mamă
// slabă), pt liste/hover. Dacă schița a pornit din „Dezaprob → fă schiță" (`disapprovesParent`), la publicare
// se materializează automat o dezaprobare pe detaliul-mamă (poziție + comentariu-justificare).
export async function publish(input: {
  sketchId: string;
  authorId: string;
  strokes?: unknown;
  note?: unknown;
  thumbnailUrl?: string | null;
}): Promise<SketchResult> {
  if (!isUuid(input.sketchId)) return { ok: false, error: "SKETCH_NOT_FOUND" }; // SEC-11
  const sketch = await getSketchById(input.sketchId);
  if (!sketch) return { ok: false, error: "SKETCH_NOT_FOUND" };
  if (sketch.authorId !== input.authorId) return { ok: false, error: "FORBIDDEN" };
  if (sketch.status !== SKETCH_STATUS.DRAFT) return { ok: false, error: "INVALID_STATE" };

  let note: string | null | undefined;
  if (input.note !== undefined) {
    const noteValidation = validateSketchNote(input.note);
    if (!noteValidation.ok) return { ok: false, error: "NOTE_TOO_LONG" };
    note = noteValidation.value;
  }

  // Stroke-urile pot veni odată cu PUBLISH (salvare finală) sau să fie deja persistate.
  let strokes = sketch.strokesJson as Stroke[] | null;
  if (input.strokes !== undefined) {
    const validation = validateStrokes(input.strokes);
    if (!validation.ok) {
      return { ok: false, error: validation.error === "EMPTY" ? "EMPTY_STROKES" : "INVALID_STROKES" };
    }
    strokes = validation.value;
    await updateStrokes(input.sketchId, strokes, note);
  } else if (note !== undefined && strokes) {
    await updateStrokes(input.sketchId, strokes, note);
  }
  if (!strokes || strokes.length === 0) return { ok: false, error: "EMPTY_STROKES" };

  const detail = await getDetailById(sketch.detailId);
  if (!detail) return { ok: false, error: "DETAIL_NOT_FOUND" };

  // PLAFONUL de adnotări — impus pe server, ÎNAINTE de tranziție: n-are sens să publicăm și abia apoi să
  // ne plângem. Draftul curent e încă DRAFT, deci nu se numără pe el însuși. Un draft început când erau 2
  // adnotări poate ajunge la publicare când sunt 3 (altă filă) → refuzăm aici, nu la deschiderea editorului.
  // Cursă acceptată conștient: două publicări simultane ale ACELUIAȘI autor pot trece amândouă de check și
  // duce la 4. E o cursă cu sine însuși, fără consecință distructivă (nimic nu se șterge), iar remediul —
  // blocare la nivel de rând — nu justifică complexitatea. Ștergerea rămâne oricând la îndemâna autorului.
  if (isSelfAnnotation({ sketchAuthorId: sketch.authorId, detailAuthorId: detail.ownerId })) {
    const count = await countAnnotationsByDetail(sketch.detailId);
    if (!canAddAnnotation(count)) return { ok: false, error: "ANNOTATION_LIMIT" };
  }

  // Tranziție atomică DRAFT → PUBLISHED (guard pe status + autor). Două PUBLISH concurente: doar primul prinde
  // rândul → doar el notifică / materializează. Al doilea iese cu INVALID_STATE, fără efecte duble.
  const authorRole = await getRoleByUserId(sketch.authorId);
  const transitioned = await publishFromDraft(input.sketchId, input.authorId, {
    thumbnailUrl: input.thumbnailUrl ?? null,
    publishedAt: new Date(),
    roleSnapshot: authorRole ? snapshotFromRole(authorRole) : null,
  });
  if (!transitioned) return { ok: false, error: "INVALID_STATE" };

  // STACK: foile pe care s-a construit devin BLOCATE acum — din acest moment intră într-o dezbatere
  // și nu mai pot dispărea complet de sub desenul de deasupra.
  //
  // Între apăsarea „Schițează peste" (când s-a înghețat rețeta) și publicare pot trece ore, iar o foaie
  // din fundal poate fi ștearsă între timp — încă nu era blocată, deci ștergerea era permisă. Reverificăm
  // ACUM ce mai există și curățăm rețeta, ca schița publicată să nu rămână cu referințe moarte pe care
  // randarea le-ar sări tăcut. Se face DUPĂ tranziția atomică: dacă publicarea eșuează, n-am blocat
  // degeaba foile altcuiva.
  const declaredBases = (sketch.baseSketchIds as string[] | null) ?? [];
  if (declaredBases.length > 0) {
    const aliveBases = await filterPublishedSketchIds(sketch.detailId, declaredBases);
    if (aliveBases.length !== declaredBases.length) {
      await updateBaseSketchIds(sketch.id, aliveBases);
    }
    await lockStackBases(aliveBases, new Date());
  }

  // Dezaprobare-prin-schiță: acum (la publicare) materializăm poziția + justificarea pe detaliul-mamă.
  // Dacă userul abandonase editorul, nu se ajungea aici → nicio dezaprobare „mută".
  if (sketch.disapprovesParent) {
    await recordSketchDisapproval({ userId: sketch.authorId, detailId: sketch.detailId });
  }

  // ADNOTARE (autorul pe propriul detaliu) → nimeni de anunțat: destinatarul ar fi chiar el. Notificarea
  // are sens doar la o contribuție PRIMITĂ de la altcineva. Vezi `isSelfAnnotation` (domain/sketch.ts).
  if (!isSelfAnnotation({ sketchAuthorId: sketch.authorId, detailAuthorId: detail.ownerId })) {
    const author = await getNotificationActor(sketch.authorId);
    await notifySketchProposed({
      recipientUserId: detail.ownerId,
      sketchId: sketch.id,
      detailId: sketch.detailId,
      detailTitle: detail.title,
      sketchAuthorName: author?.name ?? null,
      sketchAuthorRole: author?.roleMain ?? null,
      sketchAuthorSubRole: author?.subRole ?? null,
      sketchAuthorVerified: author?.verification === "VERIFIED",
    });
  }
  return { ok: true };
}

// ȘTERGE o schiță (moderare post-publicare). Permis dacă actorul e AUTORUL schiței (orice status al ei)
// SAU AUTORUL detaliului-mamă (moderare pe detaliul lui). Cascadă: validări + comentarii pe schiță + blob.
// Notifică autorul schiței doar dacă a șters-o altcineva (autorul-mamă).
export async function deleteSketch(input: {
  sketchId: string;
  actorUserId: string;
}): Promise<SketchResult> {
  if (!isUuid(input.sketchId)) return { ok: false, error: "SKETCH_NOT_FOUND" }; // SEC-11
  const sketch = await getSketchById(input.sketchId);
  if (!sketch) return { ok: false, error: "SKETCH_NOT_FOUND" };

  const detail = await getDetailById(sketch.detailId);
  const isSketchAuthor = sketch.authorId === input.actorUserId;
  // `ownerId` (proprietarul real), NU `authorId` (mascat de anonimizare, poate fi null) — altfel
  // autorul unui detaliu retras pierde dreptul de moderare pe propriile schițe.
  const isDetailAuthor = detail?.ownerId === input.actorUserId;

  // STACK, Faza B: o foaie pe care alții au construit nu mai dispare complet. Regula (și cine ce poate
  // face pe ea) e pură și trăiește în domain — vezi `resolveSketchDeletionMode`.
  const mode = resolveSketchDeletionMode({
    lockedAt: sketch.lockedAt,
    isSketchAuthor,
    isDetailAuthor,
  });
  if (mode === "FORBIDDEN") {
    // Două cauze distincte, două erori distincte: un străin nu are ce căuta aici (FORBIDDEN), iar
    // moderatorul unei foi blocate primește un refuz EXPLICABIL în UI, nu unul de permisiuni.
    return {
      ok: false,
      error: !isSketchAuthor && !isDetailAuthor ? "FORBIDDEN" : "SKETCH_LOCKED",
    };
  }

  if (mode === "PARTIAL") {
    // Nu se șterge nimic: nici rândul, nici thumbnail-ul, nici validările/comentariile de pe foaie.
    // Pozițiile altora rămân valide — desenul pe care s-au pronunțat e încă acolo, doar semnătura nu.
    await markAuthorRemoved(input.sketchId);
    return { ok: true };
  }

  const thumbnailUrl = await deleteSketchCascade(input.sketchId);
  await deleteBlobs([thumbnailUrl]);

  // Autorul-mamă a șters schița altui user → îl anunțăm. Dacă autorul și-a șters propria schiță, fără notificare.
  if (isDetailAuthor && !isSketchAuthor && detail) {
    await notifySketchDeleted({
      recipientUserId: sketch.authorId,
      detailId: sketch.detailId,
      detailTitle: detail.title,
    });
  }
  return { ok: true };
}

// ADNOTAREA autorului, creată ÎNTR-UN PAS la publicarea detaliului (fără ciornă intermediară vizibilă):
// autorul a desenat peste propria imagine în formular, deci intenția e deja finală. Compune fluxul
// existent (createDraft → publish) ca să moștenească TOATE gardurile lui — nu le duplicăm.
//
// Authz (server, fără IDOR): doar AUTORUL detaliului poate adnota acel detaliu. Un `detailId` străin →
// FORBIDDEN, nu creăm nimic.
export async function createAnnotation(input: {
  detailId: string;
  authorId: string;
  strokes: unknown;
  // Explicația în cuvinte, opțională (2026-08-02) — validată în `publish` prin `validateSketchNote`.
  note?: unknown;
}): Promise<SketchResult<{ sketchId: string }>> {
  if (!isUuid(input.detailId)) return { ok: false, error: "DETAIL_NOT_FOUND" }; // SEC-11

  // Validăm stroke-urile ÎNAINTE de a insera ceva: altfel un payload invalid ar lăsa în urmă o ciornă
  // goală, orfană, vizibilă userului în „Ciornele mele" pentru un pas pe care nu l-a început niciodată.
  const validation = validateStrokes(input.strokes);
  if (!validation.ok) {
    return { ok: false, error: validation.error === "EMPTY" ? "EMPTY_STROKES" : "INVALID_STROKES" };
  }

  const detail = await getDetailById(input.detailId);
  if (!detail) return { ok: false, error: "DETAIL_NOT_FOUND" };
  if (!isSelfAnnotation({ sketchAuthorId: input.authorId, detailAuthorId: detail.ownerId })) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const created = await createDraft({ detailId: input.detailId, authorId: input.authorId });
  if (!created.ok) return created;

  // Fără thumbnail: adnotarea nu apare în liste/teanc/teaser public (singurii consumatori de
  // `thumbnailUrl`) → n-am randa un PNG pe care nu-l vede nimeni.
  const published = await publish({
    sketchId: created.value.sketchId,
    authorId: input.authorId,
    strokes: validation.value,
    note: input.note,
  });
  if (!published.ok) return published;
  return { ok: true, value: { sketchId: created.value.sketchId } };
}

// ── Citiri ──────────────────────────────────────────────────────────────────

// Teancul public = schițele PUBLISHED ale ALTOR useri (model fork/PR). Adnotarea autorului pe propriul
// detaliu e exclusă de repo — se citește separat cu `getAnnotation`.
export function getTeanc(detailId: string) {
  if (!isUuid(detailId)) return Promise.resolve([]); // SEC-11
  return listPublishedByDetail(detailId);
}

// ADNOTĂRILE autorului peste propriul detaliu (0..MAX_ANNOTATIONS_PER_DETAIL, în ordinea desenării).
// Nu sunt taburi în teanc — se randează peste imaginea de bază, una câte una, la cererea cititorului.
// Vezi `isSelfAnnotation` (server/domain/sketch.ts) pentru semantică.
export function getAnnotations(detailId: string) {
  if (!isUuid(detailId)) return Promise.resolve([]); // SEC-11
  return listAnnotationsByDetail(detailId);
}

// Teaser PUBLIC (fără sesiune) — DOAR schițe PUBLISHED (repo-ul filtrează; o schiță ștearsă/DRAFT
// întoarce null, uniform, fără să distingem cauza — anti-enumerare, la fel ca restul platformei).
export function getPublicSketch(sketchId: string) {
  if (!isUuid(sketchId)) return Promise.resolve(null);
  return getPublicSketchTeaser(sketchId);
}

// Ciornele userului curent (DRAFT) — pentru pagina „Ciornele mele" (reluare oricând).
export function getMyDrafts(userId: string) {
  return listDraftsByAuthor(userId);
}

// Șterge o ciornă a userului curent (doar DRAFT, doar a lui). Întoarce dacă s-a șters ceva.
export function deleteDraft(input: { sketchId: string; authorId: string }): Promise<boolean> {
  if (!isUuid(input.sketchId)) return Promise.resolve(false); // SEC-11
  return deleteDraftByAuthor(input.sketchId, input.authorId);
}

// Schița pentru editare — doar autorul, doar DRAFT.
export async function getDraftForEdit(
  sketchId: string,
  authorId: string,
): Promise<SketchResult<{ detailId: string; strokes: Stroke[]; note: string | null }>> {
  if (!isUuid(sketchId)) return { ok: false, error: "SKETCH_NOT_FOUND" }; // SEC-11
  const sketch = await getSketchById(sketchId);
  if (!sketch) return { ok: false, error: "SKETCH_NOT_FOUND" };
  if (sketch.authorId !== authorId) return { ok: false, error: "FORBIDDEN" };
  if (sketch.status !== SKETCH_STATUS.DRAFT) return { ok: false, error: "INVALID_STATE" };
  return {
    ok: true,
    value: {
      detailId: sketch.detailId,
      strokes: (sketch.strokesJson as Stroke[] | null) ?? [],
      note: sketch.note,
    },
  };
}
