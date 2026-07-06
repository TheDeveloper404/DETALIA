import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { adminLoginTokens } from "../db/schema";
import { consumeAdminLoginToken } from "../server/repos/adminsRepo";

// SEC-S3 (docs/SECURITATE.md): consumul token-ului de magic link admin trebuie să fie ATOMIC —
// două cereri paralele cu același token (dublu-click / retry) nu trebuie să poată produce
// amândouă o sesiune de admin dintr-un singur token one-time.

test("consumeAdminLoginToken: două consumuri paralele ale aceluiași token → doar unul reușește", async () => {
  const token = `e2e-admin-token-${Date.now()}`;
  const email = "e2e-admin@detalia.test";
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(adminLoginTokens).values({ token, email, expires });

  try {
    const [first, second] = await Promise.all([consumeAdminLoginToken(token), consumeAdminLoginToken(token)]);

    const results = [first, second];
    const successes = results.filter((r) => r === email);
    const failures = results.filter((r) => r === null);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const remaining = await db.select().from(adminLoginTokens).where(eq(adminLoginTokens.token, token));
    expect(remaining).toHaveLength(0);
  } finally {
    await db.delete(adminLoginTokens).where(eq(adminLoginTokens.token, token));
  }
});

test("consumeAdminLoginToken: token expirat nu poate fi consumat", async () => {
  const token = `e2e-admin-token-expired-${Date.now()}`;
  const email = "e2e-admin-expired@detalia.test";
  const expired = new Date(Date.now() - 60 * 1000);

  await db.insert(adminLoginTokens).values({ token, email, expires: expired });

  try {
    const result = await consumeAdminLoginToken(token);
    expect(result).toBeNull();
  } finally {
    await db.delete(adminLoginTokens).where(eq(adminLoginTokens.token, token));
  }
});
