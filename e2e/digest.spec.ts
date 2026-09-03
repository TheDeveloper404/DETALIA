import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { users } from "../db/schema";
import { createSignedToken } from "../lib/signed-token";
import { DIGEST_UNSUBSCRIBE_PURPOSE } from "../server/services/digestService";
import { getSeed } from "./seed";

// Digest săptămânal — dezabonarea prin linkul semnat din email (`/api/digest/unsubscribe`), la nivel
// de INTEGRARE (rută + token HMAC + DB). Unit-urile acoperă `signed-token` și logica de asamblare;
// aici verificăm glue-ul real: token valid → flag pe false; token stricat → 400; GET NU mutează
// (prefetch-ul clienților de email nu trebuie să dezaboneze).
async function digestFlag(userId: string): Promise<boolean | undefined> {
  const [row] = await db
    .select({ v: users.weeklyDigestEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.v;
}

test("unsubscribe: POST cu token valid pune weekly_digest_enabled pe false", async ({ request }) => {
  const { testerUserId } = getSeed();
  const token = createSignedToken(DIGEST_UNSUBSCRIBE_PURPOSE, testerUserId);
  try {
    const res = await request.post("/api/digest/unsubscribe", { form: { token } });
    expect(res.status()).toBe(200);
    expect(await digestFlag(testerUserId)).toBe(false);
  } finally {
    await db.update(users).set({ weeklyDigestEnabled: true }).where(eq(users.id, testerUserId));
  }
});

test("unsubscribe: POST cu token stricat → 400, flagul rămâne neschimbat", async ({ request }) => {
  const { testerUserId } = getSeed();
  const res = await request.post("/api/digest/unsubscribe", { form: { token: "invalid" } });
  expect(res.status()).toBe(400);
  expect(await digestFlag(testerUserId)).toBe(true);
});

test("unsubscribe: GET cu token valid NU dezabonează (safe la prefetch)", async ({ request }) => {
  const { testerUserId } = getSeed();
  const token = createSignedToken(DIGEST_UNSUBSCRIBE_PURPOSE, testerUserId);
  const res = await request.get(`/api/digest/unsubscribe?token=${encodeURIComponent(token)}`);
  expect(res.status()).toBe(200);
  expect(await digestFlag(testerUserId)).toBe(true);
});
