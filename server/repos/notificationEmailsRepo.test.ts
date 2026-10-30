import { beforeEach, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  return { db: (await createTestDb()).db };
});
const { db } = await import("@/db");
const { comments, details, notificationEmailDeliveries, notifications, projectMembers, projects, sketches, users } = await import("@/db/schema");
const { deleteReadNotificationsOlderThan, insertNotification, markOneRead, upsertApprovalNotification } = await import("./notificationsRepo");
const { claimEmailDeliveries, cleanupEmailDeliveries, createDueEmailDeliveries, finishEmailDelivery,
  listDeliverableEmailEvents, saveEmailSnapshot } = await import("./notificationEmailsRepo");
const { disableActivityEmails } = await import("./usersRepo");

beforeEach(async () => { await db.execute(sql`truncate users cascade`); });
async function seed() {
  const [recipient, actor] = await db.insert(users).values([
    { name: "Destinatar", email: `${crypto.randomUUID()}@test.invalid` },
    { name: "Autor", email: `${crypto.randomUUID()}@test.invalid` },
  ]).returning();
  const [detail] = await db.insert(details).values({ authorId: recipient.id, title: "Detaliu pentru email" }).returning();
  const [comment] = await db.insert(comments).values({ targetType: "DETAIL", targetId: detail.id, authorId: actor.id, body: "Comentariu" }).returning();
  const notification = await insertNotification({ recipientUserId: recipient.id, type: "COMMENT_ADDED",
    payloadJson: { detailId: detail.id, detailTitle: detail.title, commentId: comment.id } });
  return { recipient, actor, detail, comment, notification };
}
async function due(now: Date) {
  await db.update(notifications).set({ emailDueAt: new Date(now.getTime() - 31 * 60_000) });
  await createDueEmailDeliveries(now);
  return claimEmailDeliveries(now);
}

// "Emailuri pe destinatar/detaliu dupa 30 minute, doar pentru activitate importanta necitita si cu acces actual"
it("INSERT-ul notificarii include atomic scadenta; fara backfill pentru istoric si fara email pentru aprobari", async () => {
  const { notification, recipient, detail, actor } = await seed();
  expect(notification.emailDueAt!.getTime() - Date.now()).toBeGreaterThan(29 * 60_000);
  expect(notification.emailDueAt!.getTime() - Date.now()).toBeLessThan(31 * 60_000);
  await upsertApprovalNotification({ recipientUserId: recipient.id, actorId: actor.id, targetType: "DETAIL", targetId: detail.id, detailId: detail.id, detailTitle: detail.title });
  const [approval] = await db.select().from(notifications).where(eq(notifications.type, "APPROVAL_RECEIVED"));
  expect(approval.emailDueAt).toBeNull();
});

// "IMPORTANT dupa 30 minute" — termenul primului eveniment al grupului, inclusiv cele recente.
it("doua revendicari concurente nu dubleaza grupul si includ evenimentul mai recent", async () => {
  const { notification, recipient, detail, comment } = await seed();
  const now = new Date();
  await db.update(notifications).set({ emailDueAt: new Date(now.getTime() - 1) }).where(eq(notifications.id, notification.id));
  await insertNotification({ recipientUserId: recipient.id, type: "COMMENT_REPLIED", payloadJson: { detailId: detail.id, commentId: comment.id } });
  await Promise.all([createDueEmailDeliveries(now), createDueEmailDeliveries(now)]);
  expect(await db.select().from(notificationEmailDeliveries)).toHaveLength(1);
  const claimed = (await Promise.all([claimEmailDeliveries(now), claimEmailDeliveries(now)])).flat();
  expect(claimed).toHaveLength(1);
  expect(await listDeliverableEmailEvents(claimed[0])).toHaveLength(2);
});

// "Snapshot si ID stabil de livrare pentru retry cu aceeasi cheie Resend si acelasi payload."
it("lease-ul expirat se revendica cu token nou; workerul vechi nu poate finaliza sau salva snapshot", async () => {
  await seed(); const now = new Date();
  const [first] = await due(now);
  expect(await claimEmailDeliveries(new Date(now.getTime() + 60_000))).toHaveLength(0);
  const later = new Date(now.getTime() + 180_000);
  const [second] = await claimEmailDeliveries(later);
  expect(second.id).toBe(first.id); expect(second.leaseToken).not.toBe(first.leaseToken);
  expect(await saveEmailSnapshot(first, { secret: "old" }, later)).toBe(false);
  await finishEmailDelivery(first, "SENT");
  expect((await db.select().from(notificationEmailDeliveries))[0].status).toBe("LEASED");
  expect(await saveEmailSnapshot(second, { stable: true }, later)).toBe(true);
  await finishEmailDelivery(second, "SENT");
  expect((await db.select().from(notifications))[0].emailDueAt).toBeNull();
  await cleanupEmailDeliveries(0);
  await createDueEmailDeliveries(later);
  expect(await claimEmailDeliveries(later)).toHaveLength(0);
});

// "Rezumat zilnic" — un singur batch per destinatar si cutoff, chiar daca se repeta cronul.
it("DAILY foloseste cutoff 07 UTC, preia restantele si lasa activitatea ulterioara pentru ziua urmatoare", async () => {
  const { recipient, notification, detail } = await seed();
  const cutoff = new Date("2026-10-30T07:00:00Z");
  await db.update(users).set({ activityEmailMode: "DAILY" }).where(eq(users.id, recipient.id));
  await db.update(notifications).set({ createdAt: new Date("2026-10-29T08:00:00Z"), emailDueAt: new Date("2026-10-29T08:30:00Z") });
  const newer = await insertNotification({ recipientUserId: recipient.id, type: "SKETCH_DELETED", payloadJson: { detailId: detail.id } });
  await db.update(notifications).set({ createdAt: new Date("2026-10-30T07:01:00Z") }).where(eq(notifications.id, newer.id));
  await createDueEmailDeliveries(new Date(cutoff.getTime() - 1));
  expect(await db.select().from(notificationEmailDeliveries)).toHaveLength(0);
  await createDueEmailDeliveries(cutoff); await createDueEmailDeliveries(cutoff);
  const [batch] = await claimEmailDeliveries(cutoff);
  expect((await listDeliverableEmailEvents(batch)).map((row) => row.id)).toEqual([notification.id]);
  await finishEmailDelivery(batch, "SENT");
  await createDueEmailDeliveries(new Date("2026-10-30T08:00:00Z"));
  expect(await claimEmailDeliveries(new Date("2026-10-30T08:00:00Z"))).toHaveLength(0);
  await createDueEmailDeliveries(new Date("2026-10-31T07:00:00Z"));
  expect(await claimEmailDeliveries(new Date("2026-10-31T07:00:00Z"))).toHaveLength(1);
});

// "La trimitere se elimina evenimentele citite, disparute ori fara acces actual."
it.each(["citit", "comentariu ascuns", "comentariu sters", "ciorna", "cont suspendat", "cont sters", "dezabonat"])("revalidare la trimitere: %s", async (scenario) => {
  const { recipient, notification, comment, detail } = await seed();
  const [batch] = await due(new Date());
  expect(await listDeliverableEmailEvents(batch)).toHaveLength(1);
  if (scenario === "citit") await markOneRead(recipient.id, notification.id);
  if (scenario === "comentariu ascuns") await db.update(comments).set({ hiddenAfterRelease: true }).where(eq(comments.id, comment.id));
  if (scenario === "comentariu sters") await db.delete(comments).where(eq(comments.id, comment.id));
  if (scenario === "ciorna") await db.update(details).set({ status: "DRAFT" }).where(eq(details.id, detail.id));
  if (scenario === "cont suspendat") await db.update(users).set({ status: "SUSPENDED" }).where(eq(users.id, recipient.id));
  if (scenario === "cont sters") await db.update(users).set({ status: "DELETED" }).where(eq(users.id, recipient.id));
  if (scenario === "dezabonat") await disableActivityEmails(recipient.id);
  expect(await listDeliverableEmailEvents(batch)).toHaveLength(0);
});

// "Accesul se verifica si pentru destinatar"; "Revocarea accesului ... anuleaza livrarea."
it("un membru eliminat pierde eligibilitatea, chiar daca batch-ul era deja revendicat", async () => {
  const { recipient, actor, detail } = await seed();
  const [project] = await db.insert(projects).values({ ownerId: actor.id, name: "Proiect privat", inviteToken: "fixture-not-an-invite" }).returning();
  await db.insert(projectMembers).values({ projectId: project.id, userId: recipient.id });
  await db.update(details).set({ projectId: project.id }).where(eq(details.id, detail.id));
  const [batch] = await due(new Date());
  expect(await listDeliverableEmailEvents(batch)).toHaveLength(1);
  await db.update(projectMembers).set({ removedAt: new Date() }).where(eq(projectMembers.userId, recipient.id));
  expect(await listDeliverableEmailEvents(batch)).toHaveLength(0);
});

// "Comentariile/root-ul vizibile, schitele publicate/nesterse/neascunse".
it("un reply pe radacina ascunsa sau o justificare pe schita ascunsa nu ajunge in email", async () => {
  const { recipient, actor, detail, comment, notification } = await seed();
  const [reply] = await db.insert(comments).values({ targetType: "DETAIL", targetId: detail.id, authorId: actor.id, body: "Reply", parentCommentId: comment.id }).returning();
  await db.update(notifications).set({ payloadJson: { detailId: detail.id, commentId: reply.id } }).where(eq(notifications.id, notification.id));
  const [batch] = await due(new Date());
  expect(await listDeliverableEmailEvents(batch)).toHaveLength(1);
  await db.update(comments).set({ hiddenAfterRelease: true }).where(eq(comments.id, comment.id));
  expect(await listDeliverableEmailEvents(batch)).toHaveLength(0);
  await db.update(comments).set({ hiddenAfterRelease: false }).where(eq(comments.id, comment.id));
  const [sketch] = await db.insert(sketches).values({ detailId: detail.id, authorId: recipient.id, status: "PUBLISHED", hiddenAfterRelease: true }).returning();
  await db.update(comments).set({ sketchContextId: sketch.id }).where(eq(comments.id, reply.id));
  expect(await listDeliverableEmailEvents(batch)).toHaveLength(0);
});

// "Tintele disparute ori fara acces actual sunt eliminate la trimitere."
it("o schita ascunsa dupa claim nu mai produce email", async () => {
  const { recipient, actor, detail } = await seed();
  const [sketch] = await db.insert(sketches).values({ detailId: detail.id, authorId: actor.id, status: "PUBLISHED" }).returning();
  const event = await insertNotification({ recipientUserId: recipient.id, type: "SKETCH_PROPOSED", payloadJson: { detailId: detail.id, sketchId: sketch.id } });
  const [batch] = await due(new Date());
  expect((await listDeliverableEmailEvents(batch)).map((row) => row.id)).toContain(event.id);
  await db.update(sketches).set({ hiddenAfterRelease: true }).where(eq(sketches.id, sketch.id));
  expect((await listDeliverableEmailEvents(batch)).map((row) => row.id)).not.toContain(event.id);
});

// "Un actor deja inclus nu mareste numarul si nu reseteaza unread."
it("aprobari grupate fara dubluri la reapelare si fara email", async () => {
  const { recipient, actor, detail } = await seed();
  const input = { recipientUserId: recipient.id, actorId: actor.id, targetType: "DETAIL", targetId: detail.id, detailId: detail.id, detailTitle: detail.title };
  await Promise.all([upsertApprovalNotification(input), upsertApprovalNotification(input)]);
  let rows = await db.select().from(notifications).where(eq(notifications.type, "APPROVAL_RECEIVED"));
  expect(rows).toHaveLength(1); expect(rows[0].payloadJson).toMatchObject({ actorIds: [actor.id] });
  await markOneRead(recipient.id, rows[0].id);
  const readAt = (await db.select().from(notifications).where(eq(notifications.id, rows[0].id)))[0].readAt;
  await upsertApprovalNotification(input);
  rows = await db.select().from(notifications).where(eq(notifications.type, "APPROVAL_RECEIVED"));
  expect(rows[0].readAt).toEqual(readAt);
  const [anotherActor] = await db.insert(users).values({ email: "another-actor@test.invalid" }).returning();
  await upsertApprovalNotification({ ...input, actorId: anotherActor.id });
  rows = await db.select().from(notifications).where(eq(notifications.type, "APPROVAL_RECEIVED"));
  expect(rows[0].readAt).toBeNull(); expect((rows[0].payloadJson as { actorIds: string[] }).actorIds).toHaveLength(2);
  expect(rows[0].emailDueAt).toBeNull();
});

// "Istoricul aprobarilor grupate il pastrez la curatarea notificarilor" — fix de review aprobat de Liviu.
it("curatarea pastreaza istoricul aprobarilor, iar reapelarea aceluiasi actor nu recreeaza unread", async () => {
  const { recipient, actor, detail } = await seed();
  const input = { recipientUserId: recipient.id, actorId: actor.id, targetType: "DETAIL", targetId: detail.id, detailId: detail.id, detailTitle: detail.title };
  await upsertApprovalNotification(input);
  const readAt = new Date();
  await db.update(notifications).set({ readAt, createdAt: new Date(Date.now() - 20 * 86_400_000) });
  expect(await deleteReadNotificationsOlderThan(15)).toBe(1); // comentariul, nu grupul de aprobari
  const [group] = await db.select().from(notifications);
  await upsertApprovalNotification(input);
  const rows = await db.select().from(notifications);
  expect(rows).toHaveLength(1); expect(rows[0].id).toBe(group.id); expect(rows[0].readAt).toEqual(readAt);
  expect(rows[0].payloadJson).toMatchObject({ actorIds: [actor.id] });
});

// "Se proceseaza maximum 50 de batch-uri pe rulare; restul ramane in coada."
it("batch-ul este limitat, dar rularea urmatoare ajunge si la ceilalti destinatari", async () => {
  const recipients = await db.insert(users).values(Array.from({ length: 60 }, (_, i) => ({ email: `perf-${i}@test.invalid` }))).returning();
  const content = await db.insert(details).values(recipients.map((person) => ({ authorId: person.id, title: "Detaliu pentru masurare" }))).returning();
  const now = new Date();
  await db.insert(notifications).values(recipients.map((person, i) => ({ recipientUserId: person.id, type: "SKETCH_DELETED" as const,
    payloadJson: { detailId: content[i].id }, emailDueAt: new Date(now.getTime() - 60_000) })));
  const execute = db.execute.bind(db);
  const probe = vi.spyOn(db, "execute").mockImplementationOnce((query) => execute(sql`explain (analyze, format json) ${query}`) as never);
  let explanation: { rows: Record<string, unknown>[] } | undefined;
  try { await createDueEmailDeliveries(now); explanation = await probe.mock.results[0].value; }
  finally { probe.mockRestore(); }
  const plan = (explanation!.rows[0]["QUERY PLAN"] as { "Execution Time": number; "Planning Time": number }[])[0];
  console.info("notification_email_claim_perf", { recipients: 60, executionMs: plan["Execution Time"], planningMs: plan["Planning Time"] });
  const first = await claimEmailDeliveries(now); expect(first).toHaveLength(50);
  await Promise.all(first.map((batch) => finishEmailDelivery(batch, "SENT")));
  await createDueEmailDeliveries(now);
  expect(await claimEmailDeliveries(now)).toHaveLength(10);
});
