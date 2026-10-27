import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const testDb = await createTestDb();
  // PGlite lacks neon-http's batch API; execute the genuine lazy repository queries in one real transaction.
  Object.assign(testDb.db, {
    batch: async (queries: { getQuery(): { sql: string; params: unknown[] } }[]) =>
      testDb.client.transaction(async (tx) => {
        const results = [];
        for (const query of queries) {
          const compiled = query.getQuery();
          results.push(await tx.query(compiled.sql, compiled.params));
        }
        return results;
      }),
  });
  return testDb;
});

const { db } = await import("@/db");
const { users, projects, projectMembers } = await import("@/db/schema");
const { eq, and } = await import("drizzle-orm");
const { upsertActiveMembership, removeMembership } = await import("./projectMembersRepo");
const owner = randomUUID(), member = randomUUID();

beforeAll(async () => {
  await db.insert(users).values([{ id: owner, email: "invite-owner@test.local" }, { id: member, email: "invite-member@test.local" }]);
});

describe("DET-01 — eliminare si invitatie", () => {
  // Regula aprobata: "Eliminarea membrului invalideaza automat invitatia veche."
  it("refuza tokenul citit inainte de eliminare si permite o invitatie noua", async () => {
    const [project] = await db.insert(projects).values({ ownerId: owner, name: "P", inviteToken: randomUUID() }).returning();
    expect(await upsertActiveMembership(project.id, member, project.inviteToken)).toBeTruthy();
    await removeMembership(project.id, member, "rotated-token");
    expect(await upsertActiveMembership(project.id, member, project.inviteToken)).toBe(false);
    const [membership] = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, member)));
    expect(membership.removedAt).not.toBeNull();
    expect(await upsertActiveMembership(project.id, member, "rotated-token")).toBe(true);
  });

  // Regula (CONTEXT.md): "Eliminarea membrului invalideaza automat invitatia veche."
  it.each(["join-first", "remove-first"])("pastreaza revocarea pentru ordinea secventiala: %s", async (order) => {
    const oldToken = randomUUID(), newToken = randomUUID();
    const [project] = await db.insert(projects).values({ ownerId: owner, name: "Race", inviteToken: oldToken }).returning();
    await upsertActiveMembership(project.id, member, oldToken);
    if (order === "join-first") {
      await upsertActiveMembership(project.id, member, oldToken);
      await removeMembership(project.id, member, newToken);
    } else {
      await removeMembership(project.id, member, newToken);
      await upsertActiveMembership(project.id, member, oldToken);
    }
    const [membership] = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, member)));
    expect(membership.removedAt).not.toBeNull();
    expect(await upsertActiveMembership(project.id, member, oldToken)).toBe(false);
  });
});
