// Repo membri de proiect — singurul loc cu acces Drizzle pentru tabelul `project_members`.
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { and, count, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { projectMembers, roles, users } from "@/db/schema";

import { verifiedCondition } from "@/server/repos/repoHelpers";

// Rândul de membru (poate fi eliminat — `removedAt` setat). `null` dacă userul nu a fost NICIODATĂ
// membru al acestui proiect (nu s-a inserat rând). Vezi `isActiveMember` mai jos pentru verificarea
// „membru ACUM".
export async function getMembership(projectId: string, userId: string) {
  const [row] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function isActiveMember(projectId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNull(projectMembers.removedAt),
      ),
    )
    .limit(1);
  return !!row;
}

// SEC-010 (audit securitate 2026-08-11): plafon de membri per proiect — anti-abuz.
export async function countActiveMembers(projectId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), isNull(projectMembers.removedAt)));
  return row?.c ?? 0;
}

// Alăturare (prima dată SAU re-alăturare după eliminare) — UPSERT atomic pe constrângerea unică
// (projectId, userId): un rând nou pentru prima alăturare, sau ACELAȘI rând reactivat (`removedAt =
// null`, `joinedAt` reîmprospătat) pentru re-alăturare. Un singur rând per (proiect, user) — vezi
// comentariul din db/schema.ts la `projectMembers` pentru de ce (afișarea „Autor eliminat" e o
// verificare LIVE pe acest rând, nu pe istoric).
export async function upsertActiveMembership(projectId: string, userId: string) {
  const [row] = await db
    .insert(projectMembers)
    .values({ projectId, userId })
    .onConflictDoUpdate({
      target: [projectMembers.projectId, projectMembers.userId],
      set: { removedAt: null, joinedAt: new Date() },
    })
    .returning();
  return row;
}

// Eliminare membru (doar owner, verificat în service). No-op dacă userul nu era membru activ (idempotent).
export async function removeMembership(projectId: string, userId: string) {
  await db
    .update(projectMembers)
    .set({ removedAt: new Date() })
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNull(projectMembers.removedAt),
      ),
    );
}

// Membrii ACTIVI ai unui proiect, cu nume+poză — pentru pagina proiectului (lista de colaboratori).
export async function listActiveMembers(projectId: string) {
  return db
    .select({
      id: projectMembers.id,
      userId: projectMembers.userId,
      joinedAt: projectMembers.joinedAt,
      name: users.name,
      image: users.image,
      // Rolul PLATFORMEI (nu unul „de proiect" — nu există, vezi db/schema.ts). Un membru fără rol
      // declarat (onboarding neterminat) → toate null, LEFT JOIN, nu-l scoate din listă.
      roleMain: roles.roleMain,
      subRole: roles.subRole,
      verified: sql<boolean>`${verifiedCondition}`,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .leftJoin(roles, eq(roles.userId, projectMembers.userId))
    .where(and(eq(projectMembers.projectId, projectId), isNull(projectMembers.removedAt)))
    .orderBy(projectMembers.joinedAt);
}
