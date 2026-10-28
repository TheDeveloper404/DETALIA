import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const { db } = await createTestDb();
  return {
    db: Object.assign(db, { batch: (queries: PromiseLike<unknown>[]) => Promise.all(queries) }),
  };
});
const { db } = await import("@/db");
const {
  users,
  roles,
  details,
  categories,
  detailCategories,
  sketches,
  comments,
  notifications,
  projects,
  projectMembers,
  userFollows,
  categoryFollows,
} = await import("@/db/schema");
const { setFollow, getFollowState } = await import("./followService");
const { listFeedWithTotal } = await import("@/server/repos/detailsRepo");
const { addComment, getComments } = await import("./commentService");
const { getNotifications } = await import("./notificationService");
const { getDetail } = await import("./detailService");
let owner: string,
  reader: string,
  actor: string,
  direct: string,
  cat: string,
  publicId: string,
  privateId: string,
  projectId: string,
  anonymousId: string;
beforeAll(async () => {
  const u = await db
    .insert(users)
    .values(
      ["owner", "reader", "actor", "direct"].map((name) => ({
        name,
        email: name + "@discovery.test",
      })),
    )
    .returning();
  [owner, reader, actor, direct] = u.map((r) => r.id);
  await db.insert(roles).values(
    u.map((r, i) => ({
      userId: r.id,
      roleMain: i === 0 ? ("PROIECTANT" as const) : ("EXECUTANT" as const),
      verificationStatus: i === 0 ? ("VERIFIED" as const) : ("DECLARED" as const),
    })),
  );
  [cat] = (
    await db.insert(categories).values({ name: "Discovery", slug: "discovery" }).returning()
  ).map((r) => r.id);
  [projectId] = (
    await db
      .insert(projects)
      .values({ ownerId: owner, name: "Privat", inviteToken: "fixture-discovery-project" })
      .returning()
  ).map((r) => r.id);
  await db
    .insert(projectMembers)
    .values([reader, actor, direct].map((userId) => ({ projectId, userId })));
  const d = await db
    .insert(details)
    .values([
      { title: "Discovery public", authorId: owner },
      { title: "Discovery privat", authorId: owner, projectId },
      { title: "Discovery draft", authorId: owner, status: "DRAFT" },
      {
        title: "Discovery anonim",
        authorId: owner,
        anonymizedAt: new Date(),
        authorRoleSnapshot: { roleMain: "BENEFICIAR", verificationStatus: "DECLARED" },
      },
      { title: "Discovery alt autor", authorId: direct },
    ])
    .returning();
  publicId = d[0].id;
  privateId = d[1].id;
  anonymousId = d[3].id;
  await db.insert(detailCategories).values(d.map((r) => ({ detailId: r.id, categoryId: cat })));
  await db.insert(sketches).values([
    { detailId: publicId, authorId: reader, status: "PUBLISHED" },
    { detailId: anonymousId, authorId: owner, status: "PUBLISHED", isAnnotation: true },
    { detailId: d[4].id, authorId: reader, status: "PUBLISHED", hiddenAfterRelease: true },
  ]);
});
beforeEach(async () => {
  await db.delete(userFollows);
  await db.delete(categoryFollows);
});
const feed = (extra: Partial<Parameters<typeof listFeedWithTotal>[0]> = {}) =>
  listFeedWithTotal({ q: "Discovery", limit: 50, ...extra });

describe("Follow + SQL real pentru feed", () => {
  // **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. Filtrul „Urmariti” include detaliile unui autor urmarit SAU ale unei categorii urmarite, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de user urmarit.
  it("setarea repetata este idempotenta, privata per follower; nu dezvaluie autorul anonim", async () => {
    await setFollow({ userId: reader, kind: "USER", targetId: owner, followed: true });
    await setFollow({ userId: reader, kind: "USER", targetId: owner, followed: true });
    expect(await getFollowState(reader, "USER", owner)).toBe(true);
    expect(await getFollowState(actor, "USER", owner)).toBe(false);
    const result = await feed({ followingUserId: reader });
    expect(result.rows.map((r) => r.id)).toEqual([publicId]);
    expect(result.total).toBe(1);
    expect(await db.select().from(userFollows)).toHaveLength(1);
    await setFollow({ userId: reader, kind: "USER", targetId: owner, followed: false });
    expect((await feed({ followingUserId: reader })).total).toBe(0);
  });
  // **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. Filtrul „Urmariti” include detaliile unui autor urmarit SAU ale unei categorii urmarite, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de user urmarit.
  it("categoria urmarita include anonimul public, fara proiecte/ciorne sau dubluri", async () => {
    await setFollow({ userId: reader, kind: "USER", targetId: owner, followed: true });
    await setFollow({ userId: reader, kind: "CATEGORY", targetId: cat, followed: true });
    await setFollow({ userId: reader, kind: "CATEGORY", targetId: cat, followed: true });
    const result = await feed({ followingUserId: reader });
    expect(result.total).toBe(3);
    expect(new Set(result.rows.map((r) => r.id)).size).toBe(3);
    expect(result.rows.some((r) => r.id === anonymousId)).toBe(true);
    expect(await db.select().from(categoryFollows)).toHaveLength(1);
  });
  // **Cautare avansata:** filtrele de rol al autorului, categorie, rol verificat si existenta schitelor se combina cu cautarea si „Urmariti”; rezultatele si paginarea folosesc aceleasi conditii. Rolul/verificarea urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras; schitele ascunse si adnotarile nu satisfac filtrul „cu schite”.
  it("rol + verificat + schite + categorie + follow folosesc aceleasi predicate pentru randuri/total", async () => {
    await setFollow({ userId: reader, kind: "USER", targetId: owner, followed: true });
    const result = await feed({
      followingUserId: reader,
      categoryId: cat,
      authorRole: "PROIECTANT",
      verified: true,
      withSketches: true,
      limit: 1,
    });
    expect(result.rows.map((r) => r.id)).toEqual([publicId]);
    expect(result.total).toBe(1);
    const beyond = await feed({
      followingUserId: reader,
      authorRole: "PROIECTANT",
      verified: true,
      withSketches: true,
      limit: 1,
      offset: 1,
    });
    expect(beyond.rows).toEqual([]);
    expect(beyond.total).toBe(1);
  });
  // **Cautare avansata:** filtrele de rol al autorului, categorie, rol verificat si existenta schitelor se combina cu cautarea si „Urmariti”; rezultatele si paginarea folosesc aceleasi conditii. Rolul/verificarea urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras; schitele ascunse si adnotarile nu satisfac filtrul „cu schite”.
  it("rolul anonimului este snapshot-ul afisat; adnotarile si schitele ascunse nu satisfac filtrul", async () => {
    expect((await feed({ authorRole: "BENEFICIAR" })).rows.map((r) => r.id)).toEqual([anonymousId]);
    expect((await feed({ authorRole: "BENEFICIAR", verified: true })).total).toBe(0);
    expect((await feed({ withSketches: true })).rows.map((r) => r.id)).toEqual([publicId]);
  });
  // **Cautare avansata:** filtrele de rol al autorului, categorie, rol verificat si existenta schitelor se combina cu cautarea si „Urmariti”; rezultatele si paginarea folosesc aceleasi conditii. Rolul/verificarea urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras; schitele ascunse si adnotarile nu satisfac filtrul „cu schite”.
  it("categoria inexistenta si inputul SQL sunt valori parametrizate, nu instructiuni", async () => {
    expect((await feed({ q: "' OR 1=1 --" })).total).toBe(0);
    expect((await feed({ categoryId: crypto.randomUUID() })).total).toBe(0);
  });
});

describe("Notificari comentarii cu DB real", () => {
  // **Notificari la comentarii/reply:** autorul continutului, autorul radacinii firului si autorul comentariului caruia i se raspunde primesc notificarea o singura data fiecare; actorul nu se notifica singur. Exclusiv in-app, fara extras din comentariu; accesul se verifica si pentru destinatar. La citire, notificarile noi se omit daca discutia nu mai este vizibila ori comentariul/tinta a disparut.
  it("comentariul anunta owner-ul, iar reply la reply deduplica destinatarii si exclude actorul", async () => {
    await db.delete(notifications);
    await addComment({
      userId: reader,
      targetType: "DETAIL",
      targetId: publicId,
      body: "radacina",
    });
    expect((await getNotifications(owner)).filter((r) => r.type === "COMMENT_ADDED")).toHaveLength(
      1,
    );
    const root = (await getComments("DETAIL", publicId)).find((r) => r.body === "radacina")!;
    await addComment({
      userId: direct,
      targetType: "DETAIL",
      targetId: publicId,
      body: "replica",
      parentCommentId: root.id,
    });
    const reply = (await getComments("DETAIL", publicId)).find((r) => r.body === "replica")!;
    await db.delete(notifications);
    await addComment({
      userId: actor,
      targetType: "DETAIL",
      targetId: publicId,
      body: "replica la replica",
      parentCommentId: reply.id,
    });
    const rows = await db.select().from(notifications);
    expect(rows.map((r) => r.recipientUserId).sort()).toEqual([owner, reader, direct].sort());
    expect(rows.every((r) => r.type === "COMMENT_REPLIED")).toBe(true);
    expect(rows.every((r) => !JSON.stringify(r.payloadJson).includes("replica la replica"))).toBe(
      true,
    );
    await db.delete(notifications);
    await addComment({
      userId: owner,
      targetType: "DETAIL",
      targetId: publicId,
      body: "raspund ca owner",
      parentCommentId: root.id,
    });
    expect((await db.select().from(notifications)).map((r) => r.recipientUserId)).toEqual([reader]);
  });
  // **Notificari la comentarii/reply:** autorul continutului, autorul radacinii firului si autorul comentariului caruia i se raspunde primesc notificarea o singura data fiecare; actorul nu se notifica singur. Exclusiv in-app, fara extras din comentariu; accesul se verifica si pentru destinatar. La citire, notificarile noi se omit daca discutia nu mai este vizibila ori comentariul/tinta a disparut.
  it("comentariul ascuns sau sters dispare; vechea discutie per schita nu genereaza notificari", async () => {
    await db.delete(notifications);
    await addComment({
      userId: reader,
      targetType: "DETAIL",
      targetId: publicId,
      body: "de ascuns",
    });
    const c = (await getComments("DETAIL", publicId)).find((r) => r.body === "de ascuns")!;
    expect(await getNotifications(owner)).toHaveLength(1);
    await db.update(comments).set({ hiddenAfterRelease: true }).where(eq(comments.id, c.id));
    expect(await getNotifications(owner)).toEqual([]);
    await db.delete(comments).where(eq(comments.id, c.id));
    expect(await getNotifications(owner)).toEqual([]);
    const [sketch] = await db
      .insert(sketches)
      .values({ detailId: publicId, authorId: direct, status: "PUBLISHED" })
      .returning();
    await addComment({
      userId: reader,
      targetType: "SKETCH",
      targetId: sketch.id,
      body: "pe schita",
    });
    expect(await getNotifications(direct)).toEqual([]);
    await db.update(sketches).set({ hiddenAfterRelease: true }).where(eq(sketches.id, sketch.id));
    expect(await getNotifications(direct)).toEqual([]);
  });
  // **Notificari la comentarii/reply:** autorul continutului, autorul radacinii firului si autorul comentariului caruia i se raspunde primesc notificarea o singura data fiecare; actorul nu se notifica singur. Exclusiv in-app, fara extras din comentariu; accesul se verifica si pentru destinatar. La citire, notificarile noi se omit daca discutia nu mai este vizibila ori comentariul/tinta a disparut.
  it("membrul eliminat nu mai vede titlul si nu primeste notificari noi; nici exportul nu poate citi detaliul", async () => {
    await db.delete(notifications);
    await addComment({
      userId: reader,
      targetType: "DETAIL",
      targetId: privateId,
      body: "fir privat",
    });
    const root = (await getComments("DETAIL", privateId)).find((r) => r.body === "fir privat")!;
    await addComment({
      userId: actor,
      targetType: "DETAIL",
      targetId: privateId,
      body: "primul reply",
      parentCommentId: root.id,
    });
    expect(await getNotifications(reader)).toHaveLength(1);
    await db
      .update(projectMembers)
      .set({ removedAt: new Date() })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, reader)));
    expect(await getNotifications(reader)).toEqual([]);
    expect(await getDetail(privateId, reader)).toBeNull();
    const before = (
      await db.select().from(notifications).where(eq(notifications.recipientUserId, reader))
    ).length;
    await addComment({
      userId: actor,
      targetType: "DETAIL",
      targetId: privateId,
      body: "al doilea reply",
      parentCommentId: root.id,
    });
    expect(
      (await db.select().from(notifications).where(eq(notifications.recipientUserId, reader)))
        .length,
    ).toBe(before);
    expect((await getDetail(privateId, owner))?.id).toBe(privateId);
  });
});

// **Notificari la comentarii/reply:** autorul continutului, autorul radacinii firului si autorul comentariului caruia i se raspunde primesc notificarea o singura data fiecare; actorul nu se notifica singur. Exclusiv in-app, fara extras din comentariu; accesul se verifica si pentru destinatar. La citire, notificarile noi se omit daca discutia nu mai este vizibila ori comentariul/tinta a disparut.
it("limita se aplica dupa vizibilitate: 31 ascunse nu elimina o notificare mai veche valida", async () => {
  await db.delete(notifications);
  const [visible] = await db
    .insert(comments)
    .values({ authorId: actor, targetType: "DETAIL", targetId: publicId, body: "vizibil vechi" })
    .returning();
  const [hidden] = await db
    .insert(comments)
    .values({
      authorId: actor,
      targetType: "DETAIL",
      targetId: publicId,
      body: "ascuns",
      hiddenAfterRelease: true,
    })
    .returning();
  const [old] = await db
    .insert(notifications)
    .values({
      recipientUserId: owner,
      type: "COMMENT_ADDED",
      createdAt: new Date(0),
      payloadJson: { detailId: publicId, detailTitle: "Discovery public", commentId: visible.id },
    })
    .returning();
  await db.insert(notifications).values(
    Array.from({ length: 31 }, () => ({
      recipientUserId: owner,
      type: "COMMENT_REPLIED" as const,
      payloadJson: { detailId: publicId, detailTitle: "Discovery public", commentId: hidden.id },
    })),
  );
  expect((await getNotifications(owner)).map((r) => r.id)).toEqual([old.id]);
});
