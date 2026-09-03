import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { users } from "../db/schema";
import { createSignedToken, verifySignedToken } from "../lib/signed-token";
import { setWeeklyDigestEnabled } from "../server/repos/usersRepo";
import { DIGEST_UNSUBSCRIBE_PURPOSE } from "../server/services/digestService";
import { getSeed } from "./seed";

// Digest săptămânal — dezabonarea prin linkul semnat din email, la nivel de INTEGRARE (token HMAC +
// DB reală), în stilul proiectului `security`: apeluri directe service/repo, fără HTTP. Ruta
// `/api/digest/unsubscribe` e doar glue (parse form → verify → repo → randare pagină); logica reală e
// aici. Unit-urile din `lib/signed-token.test.ts` acoperă TTL/format-ul tokenului.
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
    const userId = verifySignedToken(DIGEST_UNSUBSCRIBE_PURPOSE, token);
    expect(userId).toBe(testerUserId);

    await setWeeklyDigestEnabled(userId!, false);
    expect(await digestFlag(testerUserId)).toBe(false);
  } finally {
    await db.update(users).set({ weeklyDigestEnabled: true }).where(eq(users.id, testerUserId));
  }
});

test("token stricat → verifySignedToken întoarce null, flagul nu se atinge", async () => {
  const { testerUserId } = getSeed();
  expect(await digestFlag(testerUserId)).toBe(true); // baseline
  expect(verifySignedToken(DIGEST_UNSUBSCRIBE_PURPOSE, "invalid")).toBeNull();
  expect(verifySignedToken(DIGEST_UNSUBSCRIBE_PURPOSE, "aa.bb.cc")).toBeNull();
  expect(await digestFlag(testerUserId)).toBe(true); // neschimbat
});

test("token semnat cu alt scop → null (nu se poate refolosi linkul pe alt endpoint)", async () => {
  const { testerUserId } = getSeed();
  const wrongScope = createSignedToken("alt-scop", testerUserId);
  expect(verifySignedToken(DIGEST_UNSUBSCRIBE_PURPOSE, wrongScope)).toBeNull();
});
