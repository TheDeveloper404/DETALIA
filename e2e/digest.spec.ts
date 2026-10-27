import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { users, details, comments, sketches, validations } from "../db/schema";
import { countCommentsOnOwnDetails, countSketchesOnOwnDetails, countValidationsOnOwnDetails } from "../server/repos/digestRepo";
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

// Regula aprobata: "Repara acum cele trei contoare" pentru contributiile ascunse din digest.
test("digestul exclude comentariile, schitele si validarile ascunse", async () => {
  const { testerUserId } = getSeed();
  const [owner] = await db.insert(users).values({ email: `digest-hidden-${crypto.randomUUID()}@detalia.test`, weeklyDigestEnabled: false }).returning();
  let detailId: string | undefined;
  try {
    const [detail] = await db.insert(details).values({ authorId: owner.id, title: "E2E digest ascuns" }).returning();
    detailId = detail.id;
    await db.insert(comments).values({ authorId: testerUserId, targetType: "DETAIL", targetId: detail.id, body: "ascuns", hiddenAfterRelease: true });
    await db.insert(sketches).values({ authorId: testerUserId, detailId: detail.id, status: "PUBLISHED", hiddenAfterRelease: true });
    await db.insert(validations).values({ userId: testerUserId, targetType: "DETAIL", targetId: detail.id, position: "APPROVE", hiddenAfterRelease: true });
    const since = new Date(Date.now() - 60_000);
    const counters = [countCommentsOnOwnDetails, countSketchesOnOwnDetails, countValidationsOnOwnDetails];
    expect(await Promise.all(counters.map(async (counter) => (await counter(since)).get(owner.id) ?? 0))).toEqual([0, 0, 0]);
    await db.update(comments).set({ hiddenAfterRelease: false }).where(eq(comments.targetId, detail.id));
    await db.update(sketches).set({ hiddenAfterRelease: false }).where(eq(sketches.detailId, detail.id));
    await db.update(validations).set({ hiddenAfterRelease: false }).where(eq(validations.targetId, detail.id));
    expect(await Promise.all(counters.map(async (counter) => (await counter(since)).get(owner.id) ?? 0))).toEqual([1, 1, 1]);
  } finally {
    if (detailId) {
      await db.delete(comments).where(eq(comments.targetId, detailId));
      await db.delete(validations).where(eq(validations.targetId, detailId));
      await db.delete(details).where(eq(details.id, detailId));
    }
    await db.delete(users).where(eq(users.id, owner.id));
  }
});
