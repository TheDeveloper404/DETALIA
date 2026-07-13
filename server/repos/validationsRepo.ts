// Repo validări — singurul loc cu acces Drizzle pentru tabelul `validations` (polimorfic Detail/Sketch).
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { roles, users, validations } from "@/db/schema";
import type { RoleSnapshot, TargetType, ValidationPosition } from "@/server/domain/validation";

// Pozițiile userului curent pe mai multe ținte deodată (batch, pentru feed) — fără N+1.
export async function listUserPositionsForTargets(
  userId: string,
  targetType: TargetType,
  targetIds: string[],
) {
  if (targetIds.length === 0) return [];
  return db
    .select({ targetId: validations.targetId, position: validations.position })
    .from(validations)
    .where(
      and(
        eq(validations.userId, userId),
        eq(validations.targetType, targetType),
        inArray(validations.targetId, targetIds),
      ),
    );
}

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

// Upsert DISAPPROVE atomic: „a avut loc tranziția spre DISAPPROVE?" se decide ÎN Postgres, într-un singur
// statement — dacă poziția existentă e deja DISAPPROVE, `setWhere` sare update-ul și RETURNING nu întoarce
// nimic (→ null). Altfel read-then-write-ul din service ar lăsa o fereastră în care două cereri paralele
// (dublu-submit) văd amândouă „nu era DISAPPROVE" și creează două comentarii-justificare.
// (Driverul neon-http nu are tranzacții — de aceea soluția e single-statement, nu BEGIN/COMMIT.)
export async function upsertDisapprovalIfTransition(input: {
  userId: string;
  targetType: TargetType;
  targetId: string;
  roleSnapshot: RoleSnapshot;
}) {
  const [row] = await db
    .insert(validations)
    .values({
      userId: input.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      position: "DISAPPROVE",
      roleSnapshot: input.roleSnapshot,
    })
    .onConflictDoUpdate({
      target: [validations.userId, validations.targetType, validations.targetId],
      set: { position: "DISAPPROVE", roleSnapshot: input.roleSnapshot, updatedAt: new Date() },
      setWhere: sql`${validations.position} <> 'DISAPPROVE'`,
    })
    .returning();
  return row ?? null; // null = era deja DISAPPROVE → apelantul NU creează alt comentariu-justificare
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
    .where(and(eq(validations.targetType, targetType), eq(validations.targetId, targetId)))
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
