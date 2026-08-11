// Repo proiecte — singurul loc cu acces Drizzle pentru tabelul `projects`.
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { and, count, eq, exists, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { projectMembers, projects } from "@/db/schema";

// SEC-010 (audit securitate 2026-08-11): plafon de proiecte per owner — anti-abuz, verificat ÎNAINTE
// de insert în service.
export async function countProjectsOwnedBy(ownerId: string): Promise<number> {
  const [row] = await db.select({ c: count() }).from(projects).where(eq(projects.ownerId, ownerId));
  return row?.c ?? 0;
}

export async function insertProject(input: { ownerId: string; name: string; inviteToken: string }) {
  const [row] = await db
    .insert(projects)
    .values({ ownerId: input.ownerId, name: input.name, inviteToken: input.inviteToken })
    .returning();
  return row;
}

export async function getProjectById(id: string) {
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return row ?? null;
}

// Căutare la /projects/join/[token] — tokenul din URL, comparat direct (stocat brut, vezi
// db/schema.ts). Un token inexistent/vechi (regenerat între timp) → null, tratat ca „link invalid",
// nu ca eroare (anti-enumerare, la fel ca fluxurile de auth existente).
export async function getProjectByInviteToken(token: string) {
  const [row] = await db.select().from(projects).where(eq(projects.inviteToken, token)).limit(1);
  return row ?? null;
}

// Regenerare link (doar owner, verificat în service): suprascrie tokenul → vechiul link, oricine îl
// mai are, devine instant invalid (nu mai există nicăieri în DB).
export async function updateInviteToken(projectId: string, newToken: string) {
  await db.update(projects).set({ inviteToken: newToken }).where(eq(projects.id, projectId));
}

export async function updateProjectName(projectId: string, name: string) {
  await db.update(projects).set({ name }).where(eq(projects.id, projectId));
}

// Ștergere rândului de proiect. Cascada de FK acoperă `project_members` și `details.projectId`, DAR
// NU validările/comentariile (polimorfice, fără FK) și nu fișierele din Blob → detaliile se șterg
// ÎNAINTE, prin projectService.deleteProject → deleteDetailCascade. Nu apela direct funcția asta cu
// detalii încă în proiect: rămân rânduri și fișiere orfane.
export async function deleteProject(id: string) {
  await db.delete(projects).where(eq(projects.id, id));
}

// Proiectele din care userul e OWNER sau MEMBRU ACTIV — pentru selectorul de la creare detaliu și
// pagina /projects. Un singur query (owner OR membru activ), nu două request-uri separate combinate în JS.
export async function listProjectsForUser(userId: string) {
  return db
    .select()
    .from(projects)
    .where(
      or(
        eq(projects.ownerId, userId),
        exists(
          db
            .select({ one: projectMembers.id })
            .from(projectMembers)
            .where(
              and(
                eq(projectMembers.projectId, projects.id),
                eq(projectMembers.userId, userId),
                isNull(projectMembers.removedAt),
              ),
            ),
        ),
      ),
    )
    .orderBy(projects.createdAt);
}
