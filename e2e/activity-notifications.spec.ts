import { encode } from "@auth/core/jwt";
import { expect, test } from "@playwright/test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { comments, details, notifications, roles, sessions, users, validations } from "../db/schema";
import { SESSION_MAX_AGE_SECONDS } from "../lib/session-config";
import { createSignedToken } from "../lib/signed-token";
import { addComment } from "../server/services/commentService";
import { approve } from "../server/services/validationService";

let people: { id: string; name: string | null }[] = [];
let detailId: string;
test.beforeEach(async ({ page, baseURL }) => {
  people = await db.insert(users).values(Array.from({ length: 3 }, (_, i) => ({
    name: `Activitate ${i} ${crypto.randomUUID()}`, email: `${crypto.randomUUID()}@e2e-activity.test`,
    emailVerified: new Date(), weeklyDigestEnabled: false, activityEmailMode: "IMPORTANT" as const, seenDetailTour: true,
  }))).returning({ id: users.id, name: users.name });
  await db.insert(roles).values(people.map((person) => ({ userId: person.id, roleMain: "EXECUTANT" as const, subRole: "Constructor" })));
  const [detail] = await db.insert(details).values({ title: `Activitate ${crypto.randomUUID()}`, authorId: people[0].id, imageUrl: "/pwa-192.png" }).returning();
  detailId = detail.id;
  const url = new URL(baseURL!); const secure = url.protocol === "https:";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  const sid = crypto.randomUUID(); const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  await db.insert(sessions).values({ sessionToken: sid, userId: people[0].id, expires: new Date(expires) });
  const token = await encode({ secret: process.env.AUTH_SECRET!, salt: cookieName, maxAge: SESSION_MAX_AGE_SECONDS,
    token: { sid, sub: people[0].id, id: people[0].id, status: "ACTIVE", name: people[0].name } });
  await page.context().addCookies([{ name: cookieName, value: token, domain: url.hostname, path: "/", expires: Math.floor(expires / 1000), httpOnly: true, secure, sameSite: "Lax" }]);
});
test.afterEach(async () => {
  if (!people.length) return;
  const ids = people.map((person) => person.id);
  await db.delete(notifications).where(inArray(notifications.recipientUserId, ids));
  if (detailId) {
    await db.delete(comments).where(and(eq(comments.targetType, "DETAIL"), eq(comments.targetId, detailId)));
    await db.delete(validations).where(eq(validations.targetId, detailId));
    await db.delete(details).where(eq(details.id, detailId));
  }
  await db.delete(sessions).where(inArray(sessions.userId, ids));
  await db.delete(roles).where(inArray(roles.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
  people = [];
});

// "Preferinte in profil: fara emailuri de activitate / interactiuni importante (implicit) / rezumat zilnic; digestul saptamanal existent ramane separat."
test("preferinte activitate persistente si dezabonare din email fara sesiune", async ({ page }) => {
  await page.goto("/profile/edit");
  const mode = page.getByRole("combobox", { name: "Emailuri de activitate", exact: true });
  await expect(mode).toHaveValue("IMPORTANT");
  await mode.selectOption("DAILY");
  await page.getByRole("button", { name: "Salvează profilul", exact: true }).click();
  await expect(page.getByText("Profilul a fost actualizat.", { exact: true })).toBeVisible();
  await page.reload(); await expect(mode).toHaveValue("DAILY");
  const [stored] = await db.select().from(users).where(eq(users.id, people[0].id));
  expect(stored.weeklyDigestEnabled).toBe(false);
  const token = createSignedToken("activity-unsubscribe", people[0].id);
  await page.context().clearCookies();
  await page.goto(`/api/activity/unsubscribe?token=${encodeURIComponent(token)}`);
  expect((await db.select().from(users).where(eq(users.id, people[0].id)))[0].activityEmailMode).toBe("DAILY");
  await page.getByRole("button", { name: "Oprește emailurile de activitate", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Emailurile de activitate au fost oprite", exact: true })).toBeVisible();
  const [after] = await db.select().from(users).where(eq(users.id, people[0].id));
  expect(after.activityEmailMode).toBe("IN_APP"); expect(after.weeklyDigestEnabled).toBe(false);
});

// "Aprobari grupate, doar in-app"; "Un actor deja inclus nu mareste numarul"; "Emailuri ... doar pentru activitate importanta necitita".
test("aprobari grupate fara dubluri si comentariu pus in coada persistenta", async ({ page }) => {
  for (const actor of [people[1], people[1], people[2], people[0]]) {
    expect(await approve({ userId: actor.id, targetType: "DETAIL", targetId: detailId })).toEqual({ ok: true });
  }
  expect(await addComment({ userId: people[1].id, targetType: "DETAIL", targetId: detailId, body: "Comentariu pentru notificare" })).toEqual({ ok: true });
  const rows = await db.select().from(notifications).where(eq(notifications.recipientUserId, people[0].id));
  const approvals = rows.filter((row) => row.type === "APPROVAL_RECEIVED");
  expect(approvals).toHaveLength(1); expect(approvals[0].emailDueAt).toBeNull();
  expect((approvals[0].payloadJson as { actorIds: string[] }).actorIds).toHaveLength(2);
  const comment = rows.find((row) => row.type === "COMMENT_ADDED")!;
  expect(comment.emailDueAt).not.toBeNull(); expect(comment.emailDeliveryId).toBeNull();
  await page.goto("/notifications");
  await expect(page.getByTestId(`notification-${approvals[0].id}`)).toContainText("Ai primit 2 aprobări");
  await expect(page.getByTestId(`notification-${comment.id}`)).toBeVisible();
  await expect.poll(async () => (await db.select().from(notifications).where(eq(notifications.id, comment.id)))[0].readAt).not.toBeNull();
});
