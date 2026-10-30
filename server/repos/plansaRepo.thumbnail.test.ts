import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  return await createTestDb();
});

const { db } = await import("@/db");
const { users, canvases } = await import("@/db/schema");
const { updateThumbnailOwned } = await import("./plansaRepo");
const { PgDialect } = await import("drizzle-orm/pg-core");

describe("thumbnail plansa", () => {
  // Regula (plansaService.ts): "Curăță blob-ul înlocuit de ACEASTĂ cerere (best-effort) DUPĂ ce noul URL e persistat."
  it("fiecare salvare primeste exact URL-ul pe care l-a inlocuit; plansa straina nu se modifica", async () => {
    const owner = randomUUID(), other = randomUUID();
    await db.insert(users).values([
      { id: owner, email: `${owner}@test.local` },
      { id: other, email: `${other}@test.local` },
    ]);
    const [canvas] = await db.insert(canvases).values({ name: "P", ownerId: owner, thumbnailUrl: "old" }).returning();
    const [a, b] = await Promise.all([
      updateThumbnailOwned(canvas.id, owner, "a"),
      updateThumbnailOwned(canvas.id, owner, "b"),
    ]);
    const previous = [a?.previousUrl, b?.previousUrl];
    expect(previous).toContain("old");
    expect(previous.filter((url) => url === "old")).toHaveLength(1);
    expect(await updateThumbnailOwned(canvas.id, other, "x")).toBeNull();
    // PGlite are o singura conexiune si serializeaza cererile: blocarea randului se verifica in statement.
    const execute = vi.spyOn(db, "execute");
    await updateThumbnailOwned(canvas.id, owner, "c");
    expect(new PgDialect().sqlToQuery(execute.mock.calls[0][0] as never).sql).toMatch(/for update/i);
    execute.mockRestore();
    expect(await updateThumbnailOwned(randomUUID(), owner, "x")).toBeNull();
  });
});
