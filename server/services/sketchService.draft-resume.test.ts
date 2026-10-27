import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  return await createTestDb();
});
vi.mock("@/server/services/notificationService", () => ({ notifySketchProposed: vi.fn(), notifySketchDeleted: vi.fn() }));
vi.mock("@/server/services/validationService", () => ({ recordSketchDisapproval: vi.fn() }));
vi.mock("@/server/services/projectService", () => ({ canAccessProjectDetail: vi.fn(async () => true) }));

const { db } = await import("@/db");
const { details, roles, sketches, users } = await import("@/db/schema");
const { createDraft, getDraftForEdit, saveStrokes } = await import("./sketchService");
const authorId = randomUUID();
const otherId = randomUUID();
let detailId: string;
const strokes = [{ kind: "free" as const, color: "#211d18", size: 8, points: [[0.1, 0.2], [0.3, 0.4]] as [number, number][] }];

beforeAll(async () => {
  await db.insert(users).values([{ id: authorId, email: "resume@test.local" }, { id: otherId, email: "resume-other@test.local" }]);
  await db.insert(roles).values([{ userId: authorId, roleMain: "EXECUTANT" }, { userId: otherId, roleMain: "EXECUTANT" }]);
  [ { id: detailId } ] = await db.insert(details).values({ authorId: otherId, title: "Resume" }).returning({ id: details.id });
});

// Regula aprobata: "fiecare apasare pe „Schiteaza” creeaza alta ciorna, chiar daca exista una goala" — "da de acord, trebuie fix".
it("reluarea aceleiasi schite goale pastreaza id-ul si un singur rand", async () => {
  const first = await createDraft({ detailId, authorId });
  const second = await createDraft({ detailId, authorId });
  expect(second).toEqual(first);
  expect(await db.select().from(sketches).where(eq(sketches.detailId, detailId))).toHaveLength(1);
});

// Regula aprobata: "daca am desenat ceva si am salvat in ciorna, trebuie si cand intru iar sa fie tot acolo."
it("salvarea si reluarea prin Schiteaza pastreaza exact desenul si nota", async () => {
  const started = await createDraft({ detailId, authorId });
  if (!started.ok) throw new Error(started.error);
  expect(await saveStrokes({ sketchId: started.value.sketchId, authorId, strokes, note: "Desen salvat" })).toEqual({ ok: true });
  const resumed = await createDraft({ detailId, authorId });
  expect(resumed).toEqual(started);
  if (!resumed.ok) throw new Error(resumed.error);
  expect(await getDraftForEdit(resumed.value.sketchId, authorId)).toEqual({ ok: true, value: { detailId, strokes, note: "Desen salvat", backgroundStrokes: [] } });
});

// Regula: "Un singur autor pe foaie." (CONTEXT.md).
it("nu reia ciorna altui autor si nu schimba intentia unei dezaprobari", async () => {
  const mine = await createDraft({ detailId, authorId });
  const other = await createDraft({ detailId, authorId: otherId });
  const disapproval = await createDraft({ detailId, authorId, disapprovesParent: true });
  expect(other).not.toEqual(mine);
  expect(disapproval).not.toEqual(mine);
  expect(await createDraft({ detailId, authorId, disapprovesParent: true })).toEqual(disapproval);
});

// Regula: "Rețeta fundalului: id-urile schițelor care erau APRINSE pe ecran când s-a apăsat „Schițează peste”, în ordine de jos în sus." (db/schema.ts).
it("pastreaza separat ciornele cu fundal diferit si nu reia o schita publicata", async () => {
  const [base] = await db.insert(sketches).values({ detailId, authorId: otherId, status: "PUBLISHED", strokesJson: strokes }).returning();
  const plain = await createDraft({ detailId, authorId });
  const stacked = await createDraft({ detailId, authorId, baseSketchIds: [base.id] });
  expect(stacked).not.toEqual(plain);
  expect(await createDraft({ detailId, authorId, baseSketchIds: [base.id] })).toEqual(stacked);
  if (!stacked.ok) throw new Error(stacked.error);
  await db.update(sketches).set({ status: "PUBLISHED" }).where(eq(sketches.id, stacked.value.sketchId));
  expect(await createDraft({ detailId, authorId, baseSketchIds: [base.id] })).not.toEqual(stacked);
});
