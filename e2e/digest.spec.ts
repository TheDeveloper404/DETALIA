import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { users } from "../db/schema";
import { createSignedToken, verifySignedToken } from "../lib/signed-token";
import { setWeeklyDigestEnabled } from "../server/repos/usersRepo";
import { DIGEST_UNSUBSCRIBE_PURPOSE } from "../server/services/digestService";
import { getSeed } from "./seed";

// Digest săptămânal — dezabonarea prin linkul semnat din email, la nivel de INTEGRARE (token HMAC +
// repo + DB reală), în stilul proiectului `security`: apeluri directe service/repo, fără HTTP (ruta
// `/api/digest/unsubscribe` e doar glue). Comportamentul lui `verifySignedToken` pe input greșit
// (null / format / scop) e acoperit de `lib/signed-token.test.ts` — aici doar drumul cap-coadă:
// token valid → userId corect → flag pe false în DB, apoi reset (self-contained, fără race cu alte teste).
async function digestFlag(userId: string): Promise<boolean | undefined> {
  const [row] = await db
    .select({ v: users.weeklyDigestEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.v;
}

test("token de unsubscribe valid → verifică userId și pune weekly_digest_enabled pe false", async () => {
  const { testerUserId } = getSeed();
  const token = createSignedToken(DIGEST_UNSUBSCRIBE_PURPOSE, testerUserId);
  try {
    expect(verifySignedToken(DIGEST_UNSUBSCRIBE_PURPOSE, token)).toBe(testerUserId);

    await setWeeklyDigestEnabled(testerUserId, false);
    expect(await digestFlag(testerUserId)).toBe(false);
  } finally {
    await db.update(users).set({ weeklyDigestEnabled: true }).where(eq(users.id, testerUserId));
  }
});
