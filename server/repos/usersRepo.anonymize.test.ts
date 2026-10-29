import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

// AUD-03 — pe repository real (PGlite), nu mock: după ștergerea contului, profilul public nu mai
// poate expune telefonul sau emailul (rămâneau în rând, cu flagul de vizibilitate încă pornit).
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const schema = await import("@/db/schema");
  const { db } = await createTestDb();
  return { db, schema };
});

const { db } = await import("@/db");
const { users, roles } = await import("@/db/schema");
const { anonymizeUserRow, completeOnboardingProfileAndRole, getPublicProfile, listUsersByRole } = await import("./usersRepo");

describe("anonymizeUserRow — date de contact după ștergerea contului", () => {
  // Conturile sterse sunt excluse din lista utilizatorilor dupa rol.
  it("contul anonimizat nu mai apare in lista rolului, chiar daca rolul ramane", async () => {
    const [active, deleted] = await db.insert(users).values([
      { name: "Cont activ", email: "role-active@test.local" },
      { name: "Cont de sters", email: "role-delete@test.local" },
    ]).returning();
    await db.insert(roles).values([active, deleted].map((user) => ({
      userId: user.id,
      roleMain: "BENEFICIAR" as const,
    })));
    expect(await listUsersByRole("BENEFICIAR")).toHaveLength(2);
    await anonymizeUserRow(deleted.id, "deleted-role@deleted.invalid");
    expect(await db.select().from(roles).where(eq(roles.userId, deleted.id))).toHaveLength(1);
    expect((await listUsersByRole("BENEFICIAR")).map((user) => user.id)).toEqual([active.id]);
  });

  // Filtrul Rol autor afiseaza toti utilizatorii rolului ales, inclusiv fara postari, cu link spre profil. Desktop/tableta: maximum 6 utilizatori, Afiseaza deschide modalul cu lista completa; mobil: doar titlu, numar si Afiseaza pentru acelasi modal. Contorul include doar detaliile publice neanonimizate. Conturile suspendate sau sterse nu apar in lista.
  it("contul suspendat nu apare in lista rolului", async () => {
    const [suspended] = await db
      .insert(users)
      .values({ name: "Cont suspendat", email: "role-suspended@test.local", status: "SUSPENDED" })
      .returning();
    await db.insert(roles).values({ userId: suspended.id, roleMain: "FURNIZOR" });
    expect(await listUsersByRole("FURNIZOR")).toEqual([]);
  });

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

  // **Cautare avansata** (meniul „Filtre", 2026-10-28): „Oameni urmăriți", „Categorii urmărite", „Așteaptă ajutor", rolul autorului si judetul se combina cu cautarea si categoria; rezultatele si paginarea folosesc aceleasi conditii. Rolul urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras. Judetul vine din profilul autorului (camp optional „Județ”, la onboarding si in editarea profilului), nu de pe detaliu: cu un judet ales apar doar detaliile autorilor care l-au setat, fara detaliile anonimizate. La stergerea contului judetul se goleste, ca restul profilului.
  it("goleste judetul, ca restul profilului", async () => {
    const [{ id }] = await db
      .insert(users)
      .values({ email: "county-delete@test.local", county: "Cluj", location: "Cluj-Napoca" })
      .returning({ id: users.id });

    await anonymizeUserRow(id, "deleted-county@deleted.invalid");

    const [row] = await db.select({ county: users.county, location: users.location }).from(users).where(eq(users.id, id));
    expect(row).toEqual({ county: null, location: null });
  });
});

// **Cautare avansata** (meniul „Filtre", 2026-10-28): „Oameni urmăriți", „Categorii urmărite", „Așteaptă ajutor", rolul autorului si judetul se combina cu cautarea si categoria; rezultatele si paginarea folosesc aceleasi conditii. Rolul urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras. Judetul vine din profilul autorului (camp optional „Județ”, la onboarding si in editarea profilului), nu de pe detaliu: cu un judet ales apar doar detaliile autorilor care l-au setat, fara detaliile anonimizate. La stergerea contului judetul se goleste, ca restul profilului.
it("onboarding-ul salveaza judetul odata cu profilul si rolul", async () => {
  const [{ id }] = await db.insert(users).values({ email: "onboarding-county@test.local" }).returning({ id: users.id });
  const ok = await completeOnboardingProfileAndRole(id, {
    firstName: "Ana",
    lastName: "Pop",
    name: "Ana Pop",
    headline: null,
    location: "Apahida",
    county: "Cluj",
    website: null,
    company: null,
    roleMain: "EXECUTANT",
    subRole: null,
    secondaryRole: null,
    coverPosition: 50,
  });
  expect(ok).toBe(true);
  const [row] = await db.select({ county: users.county, location: users.location }).from(users).where(eq(users.id, id));
  expect(row).toEqual({ county: "Cluj", location: "Apahida" });
  expect((await listUsersByRole("EXECUTANT", "Cluj")).map((u) => u.id)).toContain(id);
});
