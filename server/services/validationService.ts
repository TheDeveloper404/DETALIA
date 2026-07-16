// Service Validare — INIMA. Enforce pe SERVER toate regulile de validare pe roluri:
//  - Aprob = 1 click (upsert poziție APPROVE).
//  - Dezaprob = justificare OBLIGATORIE → respins fără ea; justificarea devine automat un Comment
//    (cu originValidationId), atribuit nume+rol. „Nu există dezaprobare mută."
//  - O singură poziție per user per țintă, reversibilă (upsert + retract).
//  - Poziția aparține ÎNTOTDEAUNA userului din sesiune (apelantul dă userId din sesiune) — fără IDOR.
//  - Doar useri cu ROL DECLARAT pot lua o poziție (poziția „cântărește" prin rol).

import { isUuid } from "@/server/domain/ids";
import {
  type RoleSnapshot,
  type TargetType,
  type ValidationPosition,
  validateJustification,
} from "@/server/domain/validation";
import { insertComment } from "@/server/repos/commentsRepo";
import { getDetailById } from "@/server/repos/detailsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import { getSketchById } from "@/server/repos/sketchesRepo";
import {
  deletePosition,
  listPositionsForTarget,
  listUserPositionsForTargets,
  upsertDisapprovalIfTransition,
  upsertPosition,
} from "@/server/repos/validationsRepo";

export type ValidationError =
  | "NO_ROLE"
  | "TARGET_NOT_FOUND"
  | "CANNOT_VALIDATE_OWN"
  | "JUSTIFICATION_REQUIRED"
  | "JUSTIFICATION_TOO_LONG"
  | "ALREADY_DISAPPROVED";

export type ValidationResult = { ok: true } | { ok: false; error: ValidationError };

// Ținta trebuie să existe (și să fie publică) înainte de a accepta o poziție / un comentariu.
export async function targetExists(targetType: TargetType, targetId: string): Promise<boolean> {
  // SEC-11: id malformat → „not found" (nu eroare SQL pe coloana uuid). Gate central pt approve/disapprove/comment.
  if (!isUuid(targetId)) return false;
  if (targetType === "DETAIL") {
    return (await getDetailById(targetId)) !== null; // getDetailById întoarce doar PUBLISHED
  }
  // SKETCH: poziții/comentarii doar pe schițe PUBLISHED (dezbaterea per schiță vine gratis, polimorfic).
  const sketch = await getSketchById(targetId);
  return sketch !== null && sketch.status === "PUBLISHED";
}

// Autorul țintei (DETAIL sau SKETCH PUBLISHED) sau null dacă nu există / nu e publică. Folosit pentru
// regula „nu te validezi pe propriul conținut" (CANNOT_VALIDATE_OWN) — enforce pe SERVER, nu doar în UI.
async function getTargetAuthorId(
  targetType: TargetType,
  targetId: string,
): Promise<string | null> {
  if (!isUuid(targetId)) return null; // SEC-11
  if (targetType === "DETAIL") {
    const detail = await getDetailById(targetId); // doar PUBLISHED
    return detail?.authorId ?? null;
  }
  const sketch = await getSketchById(targetId);
  return sketch !== null && sketch.status === "PUBLISHED" ? sketch.authorId : null;
}

// Detaliul-părinte REAL al unei ținte — NU se are încredere în `detailId` trimis de client (hidden input,
// modificabil din devtools/POST direct). Pentru SKETCH, îl derivăm din rândul schiței; pentru DETAIL,
// detailId e chiar targetId. Fără asta, un user ar putea plasa comentariul-justificare pe un detaliu
// ARBITRAR (nu părintele real al schiței) — găsit la audit intern 2026-07-16, fixat înainte de a fi folosit.
async function getRealDetailId(targetType: TargetType, targetId: string): Promise<string | null> {
  if (targetType === "DETAIL") return targetId;
  const sketch = await getSketchById(targetId);
  return sketch?.detailId ?? null;
}

function snapshotFromRole(role: {
  roleMain: string;
  subRole: string | null;
  verificationStatus: string;
}): RoleSnapshot {
  return {
    roleMain: role.roleMain,
    subRole: role.subRole,
    verificationStatus: role.verificationStatus,
  };
}

// APROB = 1 click. Idempotent (re-apăsarea rămâne APPROVE; retragerea se face explicit).
export async function approve(input: {
  userId: string;
  targetType: TargetType;
  targetId: string;
}): Promise<ValidationResult> {
  const role = await getRoleByUserId(input.userId);
  if (!role) return { ok: false, error: "NO_ROLE" };
  const authorId = await getTargetAuthorId(input.targetType, input.targetId);
  if (!authorId) return { ok: false, error: "TARGET_NOT_FOUND" };
  if (authorId === input.userId) return { ok: false, error: "CANNOT_VALIDATE_OWN" };

  await upsertPosition({
    userId: input.userId,
    targetType: input.targetType,
    targetId: input.targetId,
    position: "APPROVE",
    roleSnapshot: snapshotFromRole(role),
  });
  return { ok: true };
}

// DEZAPROB = justificare OBLIGATORIE → devine Comment cu originValidationId. Fără justificare → respins.
export async function disapprove(input: {
  userId: string;
  targetType: TargetType;
  targetId: string;
  justification: string;
}): Promise<ValidationResult> {
  const role = await getRoleByUserId(input.userId);
  if (!role) return { ok: false, error: "NO_ROLE" };

  const j = validateJustification(input.justification);
  if (!j.ok) {
    return {
      ok: false,
      error: j.error === "REQUIRED" ? "JUSTIFICATION_REQUIRED" : "JUSTIFICATION_TOO_LONG",
    };
  }

  const authorId = await getTargetAuthorId(input.targetType, input.targetId);
  if (!authorId) return { ok: false, error: "TARGET_NOT_FOUND" };
  if (authorId === input.userId) return { ok: false, error: "CANNOT_VALIDATE_OWN" };

  // NU avem încredere în input.detailId (vine din client) — îl derivăm server-side din țintă, altfel un
  // user ar putea plasa comentariul-justificare pe un detaliu ARBITRAR (nu părintele real al schiței).
  const realDetailId = await getRealDetailId(input.targetType, input.targetId);
  if (!realDetailId) return { ok: false, error: "TARGET_NOT_FOUND" };

  // O poziție DISAPPROVE deja existentă → un singur comentariu-justificare. Tranziția se decide ATOMIC în DB
  // (nu read-then-write) — altfel dublu-submit-ul paralel ar crea comentarii duplicate.
  const transition = await upsertDisapprovalIfTransition({
    userId: input.userId,
    targetType: input.targetType,
    targetId: input.targetId,
    roleSnapshot: snapshotFromRole(role),
  });

  // transition null = era deja DISAPPROVE — nu s-a creat alt comentariu-justificare (evită duplicate).
  // Bug găsit 2026-07-14: raportam `{ ok: true }` și aici, deci userul primea „succes" fals, fără să
  // știe că textul lui nu a fost salvat nicăieri.
  if (!transition) {
    return { ok: false, error: "ALREADY_DISAPPROVED" };
  }

  await insertComment({
    targetType: "DETAIL",
    targetId: realDetailId,
    authorId: input.userId,
    body: j.value,
    originValidationId: transition.id,
    // Justificarea unei dezaprobări pe SCHIȚĂ păstrează referința spre schița de origine — UI-ul
    // etichetează comentariul „pe schița N" (vezi comments-section.tsx) deși stă pe targetType DETAIL.
    sketchContextId: input.targetType === "SKETCH" ? input.targetId : null,
  });

  return { ok: true };
}

// Materializează o dezaprobare pornită din „Dezaprob → fac o schiță" — apelată la PUBLICAREA schiței
// (nu la click), ca să nu rămână o „dezaprobare mută" dacă autorul abandonează editorul. Înregistrează
// poziția DISAPPROVE pe detaliul-mamă + un comentariu-justificare care trimite la schiță (originValidationId).
// `userId` = autorul schiței (din sesiune). Cale internă (din sketchService) — guard-ul de auto-validare e
// aplicat aici defensiv: autorul-mamă nu-și dezaprobă propriul detaliu.
export async function recordSketchDisapproval(input: {
  userId: string;
  detailId: string;
}): Promise<void> {
  if (!isUuid(input.detailId)) return; // SEC-11
  const role = await getRoleByUserId(input.userId);
  if (!role) return; // fără rol nu se înregistrează poziție (regula de validare pe roluri)
  const authorId = await getTargetAuthorId("DETAIL", input.detailId);
  if (!authorId || authorId === input.userId) return; // țintă inexistentă sau propriul detaliu

  // Aceeași fereastră de race ca la disapprove (dublu-publish) → aceeași tranziție atomică în DB.
  const transition = await upsertDisapprovalIfTransition({
    userId: input.userId,
    targetType: "DETAIL",
    targetId: input.detailId,
    roleSnapshot: snapshotFromRole(role),
  });
  if (transition) {
    await insertComment({
      targetType: "DETAIL",
      targetId: input.detailId,
      authorId: input.userId,
      body: "Am propus o schiță alternativă ca dezaprobare — vezi teancul de schițe.",
      originValidationId: transition.id,
    });
  }
}

// Retragerea propriei poziții (reversibilitate). Comentariul-justificare rămâne în dezbatere
// (originValidationId devine null prin onDelete: set null) — istoricul nu se șterge.
export async function retract(input: {
  userId: string;
  targetType: TargetType;
  targetId: string;
}): Promise<ValidationResult> {
  // SEC-11: id malformat → no-op idempotent (nimic de retras), nu eroare SQL.
  if (!isUuid(input.targetId)) return { ok: true };
  await deletePosition(input.userId, input.targetType, input.targetId);
  return { ok: true };
}

// Poziția userului curent pe o listă de ținte (feed) → Map targetId → poziție. Batch, fără N+1.
export async function getMyPositions(
  userId: string,
  targetType: TargetType,
  targetIds: string[],
): Promise<Map<string, ValidationPosition>> {
  // SEC-11: filtrăm id-urile malformate înainte de query (un singur id stricat n-ar trebui să dea 500 pe tot feed-ul).
  const ids = targetIds.filter(isUuid);
  if (ids.length === 0) return new Map();
  const rows = await listUserPositionsForTargets(userId, targetType, ids);
  return new Map(rows.map((r) => [r.targetId, r.position]));
}

// Vedere pentru UI: pozițiile (cu rol), totalurile și poziția userului curent.
export async function getTargetValidationView(
  targetType: TargetType,
  targetId: string,
  currentUserId: string,
) {
  // SEC-11: id malformat → vedere goală (nu eroare SQL).
  if (!isUuid(targetId)) return { positions: [], counts: { approve: 0, disapprove: 0 }, myPosition: null };
  const positions = await listPositionsForTarget(targetType, targetId);
  const approve = positions.filter((p) => p.position === "APPROVE").length;
  const myPosition = positions.find((p) => p.userId === currentUserId)?.position ?? null;
  return {
    positions,
    counts: { approve, disapprove: positions.length - approve },
    myPosition,
  };
}
