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
  getUserPosition,
  listPositionsForTarget,
  listUserPositionsForTargets,
  upsertPosition,
} from "@/server/repos/validationsRepo";

export type ValidationError =
  | "NO_ROLE"
  | "TARGET_NOT_FOUND"
  | "JUSTIFICATION_REQUIRED"
  | "JUSTIFICATION_TOO_LONG";

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
  if (!(await targetExists(input.targetType, input.targetId))) {
    return { ok: false, error: "TARGET_NOT_FOUND" };
  }

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

  if (!(await targetExists(input.targetType, input.targetId))) {
    return { ok: false, error: "TARGET_NOT_FOUND" };
  }

  // O poziție DISAPPROVE deja existentă → un singur comentariu-justificare (evită duplicate la re-trimitere).
  const prior = await getUserPosition(input.userId, input.targetType, input.targetId);
  const validation = await upsertPosition({
    userId: input.userId,
    targetType: input.targetType,
    targetId: input.targetId,
    position: "DISAPPROVE",
    roleSnapshot: snapshotFromRole(role),
  });

  if (prior?.position !== "DISAPPROVE") {
    await insertComment({
      targetType: input.targetType,
      targetId: input.targetId,
      authorId: input.userId,
      body: j.value,
      originValidationId: validation.id,
    });
  }

  return { ok: true };
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
