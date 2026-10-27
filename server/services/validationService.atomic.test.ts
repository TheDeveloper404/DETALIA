import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  return createTestDb();
});
vi.mock("@/server/services/projectService", () => ({ canAccessProjectDetail: vi.fn(async () => true) }));
const { db, client } = await import("@/db") as typeof import("@/db") & { client: { close: () => Promise<void> } };
const { users, roles, details, sketches, validations, comments } = await import("@/db/schema");
const { disapprove, recordSketchDisapproval } = await import("./validationService");
let ownerId: string, actorId: string;
beforeAll(async () => {
  const [owner, actor] = await db.insert(users).values([{ email: "atomic-owner@test.local" }, { email: "atomic-actor@test.local" }]).returning();
  ownerId = owner.id; actorId = actor.id;
  await db.insert(roles).values({ userId: actorId, roleMain: "EXECUTANT" });
});
afterAll(() => client.close());

// Regula (CONTEXT.md): "Nu există „dezaprobare mută”."
it.each([false, true])("esecul justificarii nu lasa DISAPPROVE sau modifica aprobarea existenta: %s", async (approved) => {
  const [detail] = await db.insert(details).values({ authorId: ownerId, title: "Atomic" }).returning();
  if (approved) await db.insert(validations).values({ userId: actorId, targetType: "DETAIL", targetId: detail.id, position: "APPROVE" });
  await db.execute(sql`alter table comments add constraint fixture_reject_justification check (body <> 'force-fail')`);
  try {
    await expect(disapprove({ userId: actorId, targetType: "DETAIL", targetId: detail.id, justification: "force-fail" })).rejects.toThrow();
    const rows = await db.select().from(validations).where(and(eq(validations.userId, actorId), eq(validations.targetId, detail.id)));
    expect(rows.map((row) => row.position)).toEqual(approved ? ["APPROVE"] : []);
    expect(await db.select().from(comments).where(eq(comments.targetId, detail.id))).toHaveLength(0);
  } finally {
    await db.execute(sql`alter table comments drop constraint fixture_reject_justification`);
  }
});

// Regula (CONTEXT.md): "O singură poziție per user per țintă, reversibilă".
it("dezaprobarea unei schite pastreaza contextul si nu dubleaza justificarea", async () => {
  const [detail] = await db.insert(details).values({ authorId: ownerId, title: "Schita" }).returning();
  const [sketch] = await db.insert(sketches).values({ authorId: ownerId, detailId: detail.id, status: "PUBLISHED" }).returning();
  const input = { userId: actorId, targetType: "SKETCH" as const, targetId: sketch.id, justification: "Explicatia mea" };
  expect(await disapprove(input)).toEqual({ ok: true });
  expect(await disapprove(input)).toEqual({ ok: false, error: "ALREADY_DISAPPROVED" });
  const [position] = await db.select().from(validations).where(eq(validations.targetId, sketch.id));
  expect(await db.select().from(comments).where(eq(comments.targetId, detail.id))).toEqual([expect.objectContaining({ body: input.justification, originValidationId: position.id, wasDisapproval: true, sketchContextId: sketch.id })]);
});

// Regula (validationService.ts): "Înregistrează poziția DISAPPROVE pe detaliul-mamă + un comentariu-justificare".
it("calea automata din schita salveaza pozitia si justificarea impreuna", async () => {
  const [detail] = await db.insert(details).values({ authorId: ownerId, title: "Automat" }).returning();
  await db.execute(sql`alter table comments add constraint fixture_reject_automatic check (body <> 'Am propus o schiță alternativă ca dezaprobare — vezi teancul de schițe.')`);
  try {
    await expect(recordSketchDisapproval({ userId: actorId, detailId: detail.id })).rejects.toThrow();
    expect(await db.select().from(validations).where(eq(validations.targetId, detail.id))).toHaveLength(0);
  } finally {
    await db.execute(sql`alter table comments drop constraint fixture_reject_automatic`);
  }
  await recordSketchDisapproval({ userId: actorId, detailId: detail.id });
  await recordSketchDisapproval({ userId: actorId, detailId: detail.id });
  expect(await db.select().from(comments).where(eq(comments.targetId, detail.id))).toHaveLength(1);
});
