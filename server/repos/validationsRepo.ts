// Repo validări — singurul loc cu acces Drizzle pentru tabelul `validations` (polimorfic Detail/Sketch).
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { roles, users, validations } from "@/db/schema";
import type { RoleSnapshot, TargetType, ValidationPosition } from "@/server/domain/validation";

export async function getUserPosition(
  userId: string,
  targetType: TargetType,
  targetId: string,
) {
  const [row] = await db
    .select()
    .from(validations)
    .where(
      and(
        eq(validations.userId, userId),
        eq(validations.targetType, targetType),
        eq(validations.targetId, targetId),
      ),
    )
    .limit(1);
  return row ?? null;
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

// Pozițiile pe o țintă, cu autor (nume + rol curent) — pentru afișarea transparentă pe roluri.
export async function listPositionsForTarget(targetType: TargetType, targetId: string) {
  return db
    .select({
      userId: validations.userId,
      position: validations.position,
      createdAt: validations.createdAt,
      userName: users.name,
      userImage: users.image,
      roleMain: roles.roleMain,
      subRole: roles.subRole,
      verification: roles.verificationStatus,
    })
    .from(validations)
    .leftJoin(users, eq(users.id, validations.userId))
    .leftJoin(roles, eq(roles.userId, validations.userId))
    .where(and(eq(validations.targetType, targetType), eq(validations.targetId, targetId)))
    .orderBy(desc(validations.createdAt));
}

export type TargetPosition = Awaited<ReturnType<typeof listPositionsForTarget>>[number];
