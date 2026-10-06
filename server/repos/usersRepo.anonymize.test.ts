import { describe, expect, it, vi } from "vitest";

// AUD-03 — pe repository real (PGlite), nu mock: după ștergerea contului, profilul public nu mai
// poate expune telefonul sau emailul (rămâneau în rând, cu flagul de vizibilitate încă pornit).
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const schema = await import("@/db/schema");
  const { db } = await createTestDb();
  return { db, schema };
});

const { db } = await import("@/db");
const { users } = await import("@/db/schema");
const { anonymizeUserRow, getPublicProfile } = await import("./usersRepo");

describe("anonymizeUserRow — date de contact după ștergerea contului", () => {
  it("golește telefonul și închide vizibilitatea telefonului și a emailului", async () => {
    const [{ id }] = await db
      .insert(users)
      .values({ email: "aud03@test.local", phone: "+40700000000", phoneVisible: true, emailVisible: true })
      .returning({ id: users.id });

    await anonymizeUserRow(id, "deleted-aud03@deleted.invalid");

    const profile = await getPublicProfile(id);
    expect(profile).toMatchObject({ phone: null, phoneVisible: false, emailVisible: false });
    expect(profile?.email).toBe("deleted-aud03@deleted.invalid");
  });
});
