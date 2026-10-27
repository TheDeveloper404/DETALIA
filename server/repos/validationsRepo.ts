// Repo validări — singurul loc cu acces Drizzle pentru tabelul `validations` (polimorfic Detail/Sketch).
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { comments, roles, users, validations } from "@/db/schema";
import type { RoleSnapshot, TargetType, ValidationPosition } from "@/server/domain/validation";

// Upsert: o singură poziție per (user, targetType, targetId) — reversibilă prin schimbarea poziției.
// Conflictul pe constrângerea unică `validations_user_target_unique` → update poziție + snapshot.
export async function upsertPosition(input: {
  userId: string;
  targetType: TargetType;
  targetId: string;
  position: ValidationPosition;
  roleSnapshot: RoleSnapshot;
}) {
  const [row] = await db
    .insert(validations)
    .values({
      userId: input.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      position: input.position,
      roleSnapshot: input.roleSnapshot,
    })
    .onConflictDoUpdate({
      target: [validations.userId, validations.targetType, validations.targetId],
      set: { position: input.position, roleSnapshot: input.roleSnapshot, updatedAt: new Date() },
    })
    .returning();
  return row;
}

// Tranzitia si justificarea se scriu intr-un singur statement: orice esec anuleaza ambele scrieri.
// O pozitie deja DISAPPROVE nu produce alt comentariu (inclusiv la submit-uri concurente).
export async function upsertDisapprovalWithComment(input: {
  userId: string;
  targetType: TargetType;
  targetId: string;
  roleSnapshot: RoleSnapshot;
  detailId: string;
  body: string;
  sketchContextId?: string | null;
}): Promise<{ id: string } | null> {
  const result = await db.execute<{ id: string }>(sql`
    with transition as (
      insert into ${validations} (user_id, target_type, target_id, position, role_snapshot)
      values (${input.userId}, ${input.targetType}, ${input.targetId}, 'DISAPPROVE', ${JSON.stringify(input.roleSnapshot)}::jsonb)
      on conflict (user_id, target_type, target_id) do update
        set position = 'DISAPPROVE', role_snapshot = excluded.role_snapshot, updated_at = now()
        where ${validations.position} <> 'DISAPPROVE'
      returning id
    )
    insert into ${comments} (target_type, target_id, author_id, body, origin_validation_id, was_disapproval, sketch_context_id)
    select 'DETAIL', ${input.detailId}::uuid, ${input.userId}::uuid, ${input.body}, id, true, ${input.sketchContextId ?? null}::uuid
    from transition
    returning origin_validation_id as id
  `);
  return result.rows[0] ?? null;
}

export async function deletePosition(
  userId: string,
  targetType: TargetType,
  targetId: string,
) {
  await db
    .delete(validations)
    .where(
      and(
        eq(validations.userId, userId),
        eq(validations.targetType, targetType),
        eq(validations.targetId, targetId),
      ),
    );
}

// Pozițiile pe o țintă, cu autor (nume + rolul DIN MOMENTUL poziției).
// Afișăm `roleSnapshot` (rolul/verificarea de la momentul votului), nu rolul curent —
// altfel o schimbare ulterioară de rol ar rescrie retrospectiv contextul validărilor vechi.
// Fallback la rolul curent doar pentru înregistrările vechi fără snapshot.
export async function listPositionsForTarget(targetType: TargetType, targetId: string) {
  const rows = await db
    .select({
      userId: validations.userId,
      position: validations.position,
      createdAt: validations.createdAt,
      userName: users.name,
      userImage: users.image,
      roleSnapshot: validations.roleSnapshot,
      currentRoleMain: roles.roleMain,
      currentSubRole: roles.subRole,
      currentVerification: roles.verificationStatus,
    })
    .from(validations)
    .leftJoin(users, eq(users.id, validations.userId))
    .leftJoin(roles, eq(roles.userId, validations.userId))
    .where(
      and(
        eq(validations.targetType, targetType),
        eq(validations.targetId, targetId),
        // SEC-001 (audit 2026-08-11): poziție a altui membru, ascunsă la „Scoate în comunitate".
        eq(validations.hiddenAfterRelease, false),
      ),
    )
    .orderBy(desc(validations.createdAt));

  return rows.map((r) => {
    const snap = r.roleSnapshot as RoleSnapshot | null;
    return {
      userId: r.userId,
      position: r.position,
      createdAt: r.createdAt,
      userName: r.userName,
      userImage: r.userImage,
      roleMain: snap?.roleMain ?? r.currentRoleMain,
      subRole: snap?.subRole ?? r.currentSubRole,
      verification: snap?.verificationStatus ?? r.currentVerification,
    };
  });
}

export type TargetPosition = Awaited<ReturnType<typeof listPositionsForTarget>>[number];

// Pozițiile pe MAI MULTE ținte deodată (batch, teancul de schițe al unui detaliu) — fără N+1.
// Aceeași formă de rând ca listPositionsForTarget, plus targetId ca să poți regrupa rezultatul.
export async function listPositionsForTargets(targetType: TargetType, targetIds: string[]) {
  if (targetIds.length === 0) return [];
  const rows = await db
    .select({
      targetId: validations.targetId,
      userId: validations.userId,
      position: validations.position,
      createdAt: validations.createdAt,
      userName: users.name,
      userImage: users.image,
      roleSnapshot: validations.roleSnapshot,
      currentRoleMain: roles.roleMain,
      currentSubRole: roles.subRole,
      currentVerification: roles.verificationStatus,
    })
    .from(validations)
    .leftJoin(users, eq(users.id, validations.userId))
    .leftJoin(roles, eq(roles.userId, validations.userId))
    .where(
      and(
        eq(validations.targetType, targetType),
        inArray(validations.targetId, targetIds),
        // SEC-001 (audit 2026-08-11): poziție a altui membru, ascunsă la „Scoate în comunitate".
        eq(validations.hiddenAfterRelease, false),
      ),
    )
    .orderBy(desc(validations.createdAt));

  return rows.map((r) => {
    const snap = r.roleSnapshot as RoleSnapshot | null;
    return {
      targetId: r.targetId,
      userId: r.userId,
      position: r.position,
      createdAt: r.createdAt,
      userName: r.userName,
      userImage: r.userImage,
      roleMain: snap?.roleMain ?? r.currentRoleMain,
      subRole: snap?.subRole ?? r.currentSubRole,
      verification: snap?.verificationStatus ?? r.currentVerification,
    };
  });
}
