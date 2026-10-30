import { beforeAll, expect, it, vi } from "vitest";
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  return { db: (await createTestDb()).db };
});
const { db } = await import("@/db");
const { users, userFollows } = await import("@/db/schema");
const { getFollowedUsers, setFollow } = await import("@/server/services/followService");
let owner: string, other: string, followed: string[], foreign: string;
beforeAll(async () => {
  const people = await db.insert(users).values(Array.from({ length: 48 }, (_, index) => ({ email: `follow-list-${index}@test.invalid`, name: `Persoana ${index}` }))).returning({ id: users.id });
  owner = people[0].id; other = people[1].id;
  followed = people.slice(2, 47).map((row) => row.id);
  foreign = people[47].id;
  await db.insert(userFollows).values(followed.map((id) => ({ followerUserId: owner, followedUserId: id })));
  await db.insert(userFollows).values({ followerUserId: other, followedUserId: foreign });
});

// "Număr de urmăriri nelimitat."
// "Doar eu, in profilul meu (recomandat)"
it("paginarea ajunge la toate relatiile, fara a include lista altui user sau contacte", async () => {
  const found: string[] = [];
  let cursor: string | null = null;
  for (const expected of [20, 20, 5]) {
    const page = await getFollowedUsers(owner, cursor);
    expect(page.ok).toBe(true);
    if (!page.ok) throw new Error("pagina refuzata");
    expect(page.users).toHaveLength(expected);
    for (const user of page.users) {
      expect(user).not.toHaveProperty("email");
      expect(user).not.toHaveProperty("phone");
      found.push(user.id);
    }
    cursor = page.nextCursor;
  }
  expect(cursor).toBeNull();
  expect(new Set(found)).toEqual(new Set(followed));
  expect(found).not.toContain(foreign);
});

// "Număr de urmăriri nelimitat."
it("adaugarea altor urmariri nu este blocata dupa mai multe pagini", async () => {
  expect(await setFollow({ userId: owner, kind: "USER", targetId: foreign, followed: true })).toEqual({ ok: true, followed: true });
});
