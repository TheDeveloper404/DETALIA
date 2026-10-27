import { and, eq, gt } from "drizzle-orm";

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
