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
const { getNotifications, notifyCommentAdded } = await import("./notificationService");
const { getDetail, getUsersByRole } = await import("./detailService");
const { disapprove } = await import("./validationService");
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
  // **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. In „Filtre”, „Oameni urmăriți” arata detaliile autorilor urmariti, „Categorii urmărite” pe cele din categoriile urmarite; ambele bifate = oricare dintre ele, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de oameni urmariti.
  it("setarea repetata este idempotenta, privata per follower; nu dezvaluie autorul anonim", async () => {
    await setFollow({ userId: reader, kind: "USER", targetId: owner, followed: true });
    await setFollow({ userId: reader, kind: "USER", targetId: owner, followed: true });
    expect(await getFollowState(reader, "USER", owner)).toBe(true);
    expect(await getFollowState(actor, "USER", owner)).toBe(false);
    const result = await feed({ followedPeopleOf: reader });
    expect(result.rows.map((r) => r.id)).toEqual([publicId]);
    expect(result.total).toBe(1);
    expect(await db.select().from(userFollows)).toHaveLength(1);
    await setFollow({ userId: reader, kind: "USER", targetId: owner, followed: false });
    expect((await feed({ followedPeopleOf: reader })).total).toBe(0);
  });
  // **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. In „Filtre”, „Oameni urmăriți” arata detaliile autorilor urmariti, „Categorii urmărite” pe cele din categoriile urmarite; ambele bifate = oricare dintre ele, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de oameni urmariti.
  it("oamenii si categoriile urmarite se filtreaza separat; ambele = oricare, fara proiecte/ciorne/dubluri", async () => {
    await setFollow({ userId: reader, kind: "USER", targetId: owner, followed: true });
    await setFollow({ userId: reader, kind: "CATEGORY", targetId: cat, followed: true });
    await setFollow({ userId: reader, kind: "CATEGORY", targetId: cat, followed: true });
    const people = await feed({ followedPeopleOf: reader });
    expect(people.rows.map((r) => r.id)).toEqual([publicId]);
    const categories = await feed({ followedCategoriesOf: reader });
    expect(categories.total).toBe(3);
    expect(categories.rows.some((r) => r.id === anonymousId)).toBe(true);
    const both = await feed({ followedPeopleOf: reader, followedCategoriesOf: reader });
    expect(both.total).toBe(3);
    expect(new Set(both.rows.map((r) => r.id)).size).toBe(3);
    expect(await db.select().from(categoryFollows)).toHaveLength(1);
  });
  // **Cautare avansata** (meniul „Filtre", 2026-10-28): „Oameni urmăriți", „Categorii urmărite", „Așteaptă ajutor", rolul autorului si judetul se combina cu cautarea si categoria; rezultatele si paginarea folosesc aceleasi conditii. Rolul urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras. Judetul vine din profilul autorului (camp optional „Județ”, la onboarding si in editarea profilului), nu de pe detaliu: cu un judet ales apar doar detaliile autorilor care l-au setat, fara detaliile anonimizate. La stergerea contului judetul se goleste, ca restul profilului.
  it("rol + judet + categorie + follow folosesc aceleasi predicate pentru randuri/total", async () => {
    await db.update(users).set({ county: "Cluj" }).where(eq(users.id, owner));
    await setFollow({ userId: reader, kind: "USER", targetId: owner, followed: true });
    const result = await feed({
      followedPeopleOf: reader,
      categoryIds: [cat],
      authorRole: "PROIECTANT",
      county: "Cluj",
      limit: 1,
    });
    expect(result.rows.map((r) => r.id)).toEqual([publicId]);
    expect(result.total).toBe(1);
    const beyond = await feed({
      followedPeopleOf: reader,
      authorRole: "PROIECTANT",
      county: "Cluj",
      limit: 1,
      offset: 1,
    });
    expect(beyond.rows).toEqual([]);
    expect(beyond.total).toBe(1);
    expect((await feed({ county: "Iași" })).total).toBe(0);
    // Doar detaliul public al autorului din Cluj: nu cel anonimizat, nu al altui autor fara judet.
    expect((await feed({ county: "Cluj" })).rows.map((r) => r.id)).toEqual([publicId]);
    // Un judet pus pe detaliu (coloana veche) nu mai conteaza.
    await db.update(details).set({ county: "Iași" }).where(eq(details.id, publicId));
    expect((await feed({ county: "Iași" })).total).toBe(0);
    await db.update(users).set({ county: null }).where(eq(users.id, owner));
    expect((await feed({ county: "Cluj" })).total).toBe(0);
  });
  // **Cautare avansata** (meniul „Filtre", 2026-10-28): „Oameni urmăriți", „Categorii urmărite", „Așteaptă ajutor", rolul autorului si judetul se combina cu cautarea si categoria; rezultatele si paginarea folosesc aceleasi conditii. Rolul urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras. Judetul vine din profilul autorului (camp optional „Județ”, la onboarding si in editarea profilului), nu de pe detaliu: cu un judet ales apar doar detaliile autorilor care l-au setat, fara detaliile anonimizate. La stergerea contului judetul se goleste, ca restul profilului.
  it("rolul anonimului este snapshot-ul afisat", async () => {
    expect((await feed({ authorRole: "BENEFICIAR" })).rows.map((r) => r.id)).toEqual([anonymousId]);
  });
  // **Cautare avansata** (meniul „Filtre", 2026-10-28): „Oameni urmăriți", „Categorii urmărite", „Așteaptă ajutor", rolul autorului si judetul se combina cu cautarea si categoria; rezultatele si paginarea folosesc aceleasi conditii. Rolul urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras. Judetul vine din profilul autorului (camp optional „Județ”, la onboarding si in editarea profilului), nu de pe detaliu: cu un judet ales apar doar detaliile autorilor care l-au setat, fara detaliile anonimizate. La stergerea contului judetul se goleste, ca restul profilului.
  it("categoria inexistenta si inputul SQL sunt valori parametrizate, nu instructiuni", async () => {
    expect((await feed({ q: "' OR 1=1 --" })).total).toBe(0);
    expect((await feed({ categoryIds: [crypto.randomUUID()] })).total).toBe(0);
  });

  // Filtrul de categorii permite selectarea simultana a mai multor categorii in toata aplicatia; feed-ul include detaliile din oricare categorie selectata, fara dubluri. X elimina doar categoria respectiva din filtru, iar eliminarea ultimei categorii revine la toate detaliile.
  it("trei categorii: oricare, fara dubluri, cu acelasi total pe pagini si eliminare individuala", async () => {
    const term = "Multicat " + crypto.randomUUID();
    const selected = await db.insert(categories).values(
      Array.from({ length: 4 }, (_, i) => ({ name: `${term} ${i}`, slug: `${term}-${i}` })),
    ).returning();
    const categoryIds = selected.slice(0, 3).map((c) => c.id);
    const rows = await db.insert(details).values([
      { title: `${term} prima`, authorId: owner },
      { title: `${term} a doua`, authorId: owner },
      { title: `${term} a treia`, authorId: owner },
      { title: `${term} alta categorie`, authorId: owner },
      { title: `${term} ciorna`, authorId: owner, status: "DRAFT" as const },
      { title: `${term} proiect`, authorId: owner, projectId },
    ]).returning();
    await db.insert(detailCategories).values([
      { detailId: rows[0].id, categoryId: categoryIds[0] },
      { detailId: rows[0].id, categoryId: categoryIds[1] },
      { detailId: rows[1].id, categoryId: categoryIds[1] },
      { detailId: rows[2].id, categoryId: categoryIds[2] },
      { detailId: rows[3].id, categoryId: selected[3].id },
      { detailId: rows[4].id, categoryId: categoryIds[0] },
      { detailId: rows[5].id, categoryId: categoryIds[2] },
    ]);

    const first = await feed({ q: term, categoryIds, limit: 2 });
    const second = await feed({ q: term, categoryIds, limit: 2, offset: 2 });
    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
    expect([...first.rows, ...second.rows].map((r) => r.id).sort()).toEqual(rows.slice(0, 3).map((r) => r.id).sort());
    expect((await feed({ q: term, categoryIds: categoryIds.slice(1) })).total).toBe(3);
    expect((await feed({ q: term, categoryIds: [categoryIds[2]] })).rows.map((r) => r.id)).toEqual([rows[2].id]);
    expect((await feed({ q: term, categoryIds: [] })).total).toBe(4);
  });
});

// Filtrul Rol autor afiseaza toti utilizatorii rolului ales, inclusiv fara postari, cu link spre profil. Desktop/tableta: maximum 6 utilizatori, Afiseaza deschide modalul cu lista completa; mobil: doar titlu, numar si Afiseaza pentru acelasi modal. Contorul include doar detaliile publice neanonimizate.
it("lista rolului include utilizatori fara postari si peste sase, fara detalii private/ciorne/anonime sau date de contact", async () => {
  const term = "Directory " + crypto.randomUUID();
  const directory = await db.insert(users).values(
    Array.from({ length: 8 }, (_, i) => ({ name: `${term} ${i}`, email: `${i}-${term}@directory.test` })),
  ).returning();
  await db.insert(roles).values(directory.map((u, i) => ({
    userId: u.id,
    roleMain: i === 7 ? "FURNIZOR" as const : "BENEFICIAR" as const,
    subRole: i === 7 ? "Producător materiale" : "Beneficiar",
  })));
  await db.insert(projectMembers).values({ projectId, userId: directory[1].id });
  await db.insert(details).values([
    { title: `${term} public`, authorId: directory[1].id, imageUrl: "/pwa-192.png" },
    { title: `${term} privat`, authorId: directory[1].id, projectId, imageUrl: "/pwa-192.png" },
    { title: `${term} ciorna`, authorId: directory[1].id, status: "DRAFT", imageUrl: "/pwa-192.png" },
    { title: `${term} anonim`, authorId: directory[1].id, anonymizedAt: new Date(), imageUrl: "/pwa-192.png", authorRoleSnapshot: { roleMain: "BENEFICIAR", verificationStatus: "DECLARED" } },
  ]);

  const result = await getUsersByRole("BENEFICIAR");
  expect(result).toHaveLength(7);
  expect(result.map((u) => u.id)).toEqual(directory.slice(0, 7).map((u) => u.id));
  expect(result[0].detailCount).toBe(0);
  expect(result[1].detailCount).toBe(1);
  expect(Object.keys(result[0]).sort()).toEqual(["detailCount", "id", "image", "name", "subRole"]);
});

// Filtrul Rol autor afiseaza toti utilizatorii rolului ales, inclusiv fara postari, cu link spre profil. Desktop/tableta: maximum 6 utilizatori, Afiseaza deschide modalul cu lista completa; mobil: doar titlu, numar si Afiseaza pentru acelasi modal. Contorul include doar detaliile publice neanonimizate. Conturile suspendate sau sterse nu apar in lista. Cu un judet ales, lista contine doar utilizatorii care l-au setat in profil.
it("lista rolului cu judet contine doar utilizatorii care l-au setat in profil", async () => {
  const [cluj, fara] = await db
    .insert(users)
    .values([
      { name: "Judet Cluj", email: "county-cluj@directory.test", county: "Cluj" },
      { name: "Judet lipsa", email: "county-none@directory.test" },
    ])
    .returning();
  await db.insert(roles).values([cluj, fara].map((u) => ({ userId: u.id, roleMain: "FURNIZOR" as const })));
  expect((await getUsersByRole("FURNIZOR", "Cluj")).map((u) => u.id)).toEqual([cluj.id]);
  expect(await getUsersByRole("FURNIZOR", "Iași")).toEqual([]);
  const all = (await getUsersByRole("FURNIZOR")).map((u) => u.id);
  expect(all).toEqual(expect.arrayContaining([cluj.id, fara.id]));
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
  // **Notificari la comentarii/reply:** autorul continutului, autorul radacinii firului si autorul comentariului caruia i se raspunde primesc notificarea o singura data fiecare; actorul nu se notifica singur. Exclusiv in-app, fara extras din comentariu; accesul se verifica si pentru destinatar. La citire, notificarile noi se omit daca discutia nu mai este vizibila ori comentariul/tinta a disparut.
  it("dezaprobarea unei schite anunta owner-ul si autorul schitei, cu link la schita; actorul nu se anunta", async () => {
    await db.delete(notifications);
    const [sketch, own, removed] = await db
      .insert(sketches)
      .values([
        { detailId: publicId, authorId: direct, status: "PUBLISHED" },
        { detailId: publicId, authorId: direct, status: "PUBLISHED" },
        { detailId: publicId, authorId: direct, status: "PUBLISHED", authorRemoved: true },
      ])
      .returning();
    const disapproveSketch = (userId: string, targetId: string) =>
      disapprove({ userId, targetType: "SKETCH", targetId, justification: "nu tine" });
    expect(await disapproveSketch(reader, sketch.id)).toEqual({ ok: true });
    const rows = await db.select().from(notifications);
    expect(rows.map((r) => r.recipientUserId).sort()).toEqual([owner, direct].sort());
    expect(rows.every((r) => (r.payloadJson as { sketchId?: string }).sketchId === sketch.id)).toBe(
      true,
    );
    expect((await getNotifications(direct)).map((r) => r.type)).toEqual(["COMMENT_ADDED"]);
    await db.delete(notifications);
    expect(await disapproveSketch(direct, own.id)).toEqual({ ok: true });
    expect((await db.select().from(notifications)).map((r) => r.recipientUserId)).toEqual([owner]);
    await db.delete(notifications);
    expect(await disapproveSketch(reader, removed.id)).toEqual({ ok: true });
    expect((await db.select().from(notifications)).map((r) => r.recipientUserId)).toEqual([owner]);
  });
  // **Notificari la comentarii/reply:** autorul continutului, autorul radacinii firului si autorul comentariului caruia i se raspunde primesc notificarea o singura data fiecare; actorul nu se notifica singur. Exclusiv in-app, fara extras din comentariu; accesul se verifica si pentru destinatar. La citire, notificarile noi se omit daca discutia nu mai este vizibila ori comentariul/tinta a disparut.
  it("o schita de pe alt detaliu nu adauga destinatari si nici link spre ea", async () => {
    await db.delete(notifications);
    const [foreign] = await db
      .insert(sketches)
      .values({ detailId: privateId, authorId: direct, status: "PUBLISHED" })
      .returning();
    const [comment] = await db
      .insert(comments)
      .values({ authorId: reader, targetType: "DETAIL", targetId: publicId, body: "schita straina" })
      .returning();
    await notifyCommentAdded({
      actorId: reader,
      targetType: "DETAIL",
      targetId: publicId,
      commentId: comment.id,
      parentCommentId: null,
      replyToCommentId: null,
      sketchContextId: foreign.id,
    });
    const rows = await db.select().from(notifications);
    expect(rows.map((r) => r.recipientUserId)).toEqual([owner]);
    expect((rows[0].payloadJson as { sketchId?: string }).sketchId).toBeUndefined();
  });
  // **Notificari la comentarii/reply:** autorul continutului, autorul radacinii firului si autorul comentariului caruia i se raspunde primesc notificarea o singura data fiecare; actorul nu se notifica singur. Exclusiv in-app, fara extras din comentariu; accesul se verifica si pentru destinatar. La citire, notificarile noi se omit daca discutia nu mai este vizibila ori comentariul/tinta a disparut.
  it("autorul retras de pe detaliu (anonimizat) nu mai primeste notificari la comentarii", async () => {
    await db.delete(notifications);
    await addComment({ userId: reader, targetType: "DETAIL", targetId: anonymousId, body: "la anonim" });
    expect(await db.select().from(notifications)).toEqual([]);
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
