import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  return await createTestDb();
});

const { db } = await import("@/db");
const { users, sessions } = await import("@/db/schema");
const { insertUserSession, hasValidUserSession, revokeUserSession, deleteExpiredSessions } = await import("./sessionsRepo");
const { getUserGateInfo } = await import("./usersRepo");
const { eq } = await import("drizzle-orm");

describe("registru sesiuni", () => {
  // Regula: "Stergerea unui sid afecteaza numai acea sesiune, inclusiv copiile cookie-ului ei; celelalte dispozitive raman conectate."
  it("revoca sesiunea curenta, pastreaza al doilea dispozitiv si refuza alt user", async () => {
    const userId = randomUUID();
    await db.insert(users).values({ id: userId, email: `${userId}@test.local` });
    const first = randomUUID(), second = randomUUID();
    const expires = new Date(Date.now() + 60_000);
    await insertUserSession(first, userId, expires);
    await insertUserSession(second, userId, expires);
    expect(await hasValidUserSession(first, userId)).toBe(true);
    expect(await hasValidUserSession(first, randomUUID())).toBe(false);
    await revokeUserSession(first);
    await revokeUserSession(first);
    expect(await hasValidUserSession(first, userId)).toBe(false);
    expect(await hasValidUserSession(second, userId)).toBe(true);
  });

  // Regula: "Data din DB se stabileste o singura data si nu se prelungeste."
  it("refuza expirarea absoluta si nu modifica expirarea la citire", async () => {
    const userId = randomUUID(), sid = randomUUID();
    await db.insert(users).values({ id: userId, email: `${userId}@test.local` });
    const expires = new Date(Date.now() - 1_000);
    await insertUserSession(sid, userId, expires);
    expect(await hasValidUserSession(sid, userId)).toBe(false);
    const [row] = await db.select().from(sessions).where(eq(sessions.sessionToken, sid));
    expect(row.expires).toEqual(expires);
  });

  // Regula (sessionsRepo.ts): "Rândurile expirate nu mai autentifică pe nimeni (hasValidUserSession cere expires > now); cron-ul zilnic le curăță."
  it("curatarea sterge doar sesiunile expirate", async () => {
    const userId = randomUUID(), expired = randomUUID(), valid = randomUUID();
    await db.insert(users).values({ id: userId, email: `${userId}@test.local` });
    await insertUserSession(expired, userId, new Date(Date.now() - 1_000));
    await insertUserSession(valid, userId, new Date(Date.now() + 60_000));
    expect(await deleteExpiredSessions()).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(sessions).where(eq(sessions.sessionToken, expired))).toHaveLength(0);
    expect(await hasValidUserSession(valid, userId)).toBe(true);
  });

  // Regula: "Proxy-ul combina sesiunea valida, utilizatorul, statutul actual si rolul in query-ul portii existente."
  it("requires matching user, sid and expiry in the real SQL gate", async () => {
    const userId = randomUUID(), sid = randomUUID();
    await db.insert(users).values({ id: userId, email: `${userId}@test.local` });
    await insertUserSession(sid, userId, new Date(Date.now() + 60_000));
    expect(await getUserGateInfo(userId, sid)).toEqual({ status: "ACTIVE", hasRole: false });
    expect(await getUserGateInfo(userId, randomUUID())).toBeNull();
    expect(await getUserGateInfo(randomUUID(), sid)).toBeNull();
    await revokeUserSession(sid);
    expect(await getUserGateInfo(userId, sid)).toBeNull();
    await insertUserSession(sid, userId, new Date(Date.now() - 1_000));
    expect(await getUserGateInfo(userId, sid)).toBeNull();
  });
});
