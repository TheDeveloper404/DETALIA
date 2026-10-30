import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db";
import { sessions } from "@/db/schema";

// Expirarea se stabileste la login; citirea nu o prelungeste.
export async function insertUserSession(sessionToken: string, userId: string, expires: Date) {
  await db.insert(sessions).values({ sessionToken, userId, expires });
}

export async function hasValidUserSession(sessionToken: string, userId: string): Promise<boolean> {
  const [row] = await db.select({ userId: sessions.userId }).from(sessions).where(and(
    eq(sessions.sessionToken, sessionToken), eq(sessions.userId, userId), gt(sessions.expires, new Date()),
  )).limit(1);
  return !!row;
}

export async function revokeUserSession(sessionToken: string) {
  await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
}

// Rândurile expirate nu mai autentifică pe nimeni (hasValidUserSession cere expires > now); cron-ul zilnic le curăță.
export async function deleteExpiredSessions(): Promise<number> {
  const result = await db.execute<{ count: number }>(sql`
    with deleted as (delete from sessions where expires <= now() returning 1) select count(*)::int as count from deleted
  `);
  return result.rows[0].count;
}
