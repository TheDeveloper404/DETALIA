import { eq, sql } from "drizzle-orm";
import { afterAll, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  return createTestDb();
});
vi.mock("@/lib/image-processing", () => ({ reprocessBlobImage: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));
const { db, client } = await import("@/db") as typeof import("@/db") & { client: { close: () => Promise<void> } };
const { users, roles } = await import("@/db/schema");
const { reprocessBlobImage } = await import("@/lib/image-processing");
const { completeOnboarding } = await import("./onboardingService");
afterAll(() => client.close());

async function fixture() {
  const [user] = await db.insert(users).values({ email: `onboarding-${crypto.randomUUID()}@test.local`, firstName: "Old", lastName: "Name", name: "Old Name", image: "https://store.test/old-avatar.webp", coverImage: "https://store.test/old-cover.webp", coverPosition: 10 }).returning();
  const input = { userId: user.id, firstName: "New", lastName: "Name", roleMain: "EXECUTANT", subRole: "Electrician", secondaryRole: null as string | null, headline: "Profil nou", location: "Romania", company: null, website: null, avatarUrl: null, coverUrl: null, coverPosition: 50 };
  return { user, input };
}
async function profile(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user;
}

// Regula aprobata: "Onboarding-ul poate modifica profilul, apoi respinge declararea rolului" — "repara doar cele 2".
it.each([
  { roleMain: "INVALID", error: "INVALID_ROLE" },
  { subRole: "Arhitect", error: "INVALID_SUBROLE" },
  { secondaryRole: "INVALID", error: "INVALID_SECONDARY_ROLE" },
])("rolul invalid nu modifica profilul: $error", async ({ error, ...invalid }) => {
  const { user, input } = await fixture();
  expect(await completeOnboarding({ ...input, ...invalid })).toEqual({ ok: false, error });
  expect(await profile(user.id)).toEqual(user);
  expect(reprocessBlobImage).not.toHaveBeenCalled();
});

// Regula (roleService.ts): "Un singur rol per user".
it("un rol deja declarat nu permite rescrierea profilului prin onboarding", async () => {
  const { user, input } = await fixture();
  await db.insert(roles).values({ userId: user.id, roleMain: "BENEFICIAR" });
  expect(await completeOnboarding(input)).toEqual({ ok: false, error: "ALREADY_HAS_ROLE" });
  expect(await profile(user.id)).toEqual(user);
});

// Regula aprobata: profilul nu ramane modificat daca declararea rolului este respinsa.
it("esecul INSERT-ului de rol anuleaza si modificarile profilului", async () => {
  const { user, input } = await fixture();
  await db.execute(sql`alter table roles add constraint fixture_reject_role check (secondary_role is distinct from 'Student')`);
  try {
    await expect(completeOnboarding({ ...input, secondaryRole: "Student" })).rejects.toThrow();
    expect(await profile(user.id)).toEqual(user);
    expect(await db.select().from(roles).where(eq(roles.userId, user.id))).toHaveLength(0);
  } finally {
    await db.execute(sql`alter table roles drop constraint fixture_reject_role`);
  }
});

// Regula (onboardingService.ts): "rolul e markerul de „onboarding complet”".
it("esecul UPDATE-ului de profil nu lasa rolul creat", async () => {
  const { user, input } = await fixture();
  await db.execute(sql`alter table users add constraint fixture_reject_profile check (first_name <> 'reject-update')`);
  try {
    await expect(completeOnboarding({ ...input, firstName: "reject-update" })).rejects.toThrow();
    expect(await profile(user.id)).toEqual(user);
    expect(await db.select().from(roles).where(eq(roles.userId, user.id))).toHaveLength(0);
  } finally {
    await db.execute(sql`alter table users drop constraint fixture_reject_profile`);
  }
});

// Regula (roleService.ts): "Un singur rol per user" — o cerere pierzatoare nu modifica profilul castigatorului.
it("doua finalizari aleg un singur profil si pastreaza imaginile omise", async () => {
  const { user, input } = await fixture();
  const results = await Promise.all([completeOnboarding({ ...input, firstName: "First" }), completeOnboarding({ ...input, firstName: "Second" })]);
  expect(results.filter((result) => result.ok)).toHaveLength(1);
  expect(results.find((result) => !result.ok)).toEqual({ ok: false, error: "ALREADY_HAS_ROLE" });
  const saved = await profile(user.id);
  expect(saved.firstName).toBe(results[0].ok ? "First" : "Second");
  expect(saved.image).toBe(user.image);
  expect(saved.coverImage).toBe(user.coverImage);
  expect(saved.coverPosition).toBe(user.coverPosition);
});
