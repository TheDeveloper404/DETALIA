import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

// SQL real (PGlite) pentru digestRepo — mock-ul nu poate garanta că `listNewCommunityDetails` chiar
// exclude detaliile de proiect (invariantul transversal din CLAUDE.md) sau că numărătorile grupează
// corect pe autorul detaliului. Un singur set de date seed, verificat pe toate query-urile.
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const schema = await import("@/db/schema");
  const { db } = await createTestDb();
  return { db, schema };
});
vi.mock("@/lib/email", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/email")>(),
  sendEmailBatch: vi.fn(async (messages: { to: string }[]) => messages.length),
}));

const { db } = await import("@/db");
const { sendEmailBatch } = await import("@/lib/email");
const { sendWeeklyDigests } = await import("@/server/services/digestService");
const { users, roles, details, projects, projectMembers, comments, validations, sketches } = await import("@/db/schema");
const { listDigestRecipients, countCommentsOnOwnDetails, countSketchesOnOwnDetails, countValidationsOnOwnDetails, listNewCommunityDetails } = await import(
  "./digestRepo"
);

const DAY = 86_400_000;
const now = new Date("2026-09-07T09:00:00Z");
const since = new Date(now.getTime() - 7 * DAY);
const recent = new Date(now.getTime() - 2 * DAY);
const old = new Date(now.getTime() - 30 * DAY);

async function makeUser(
  email: string,
  opts: { role?: boolean; digest?: boolean; status?: "ACTIVE" | "SUSPENDED" } = {},
) {
  const [u] = await db
    .insert(users)
    .values({ email, status: opts.status ?? "ACTIVE", weeklyDigestEnabled: opts.digest ?? true })
    .returning({ id: users.id });
  if (opts.role ?? true) await db.insert(roles).values({ userId: u.id, roleMain: "EXECUTANT" });
  return u.id;
}

let author: string;
let other: string;
let publicDetailId: string;

beforeAll(async () => {
  author = await makeUser("digest-author@test.local");
  other = await makeUser("digest-other@test.local");
  await makeUser("digest-off@test.local", { digest: false });
  await makeUser("digest-norole@test.local", { role: false });
  await makeUser("digest-susp@test.local", { status: "SUSPENDED" });

  const [p] = await db
    .insert(projects)
    // Placeholder de fixture, NU un secret real — coloana e doar NOT NULL.
    .values({ ownerId: author, name: "Proiect", inviteToken: "fixture-placeholder-not-a-secret" })
    .returning({ id: projects.id });

  const [pub] = await db
    .insert(details)
    .values({ title: "Detaliu public", authorId: author, createdAt: recent, views: 5 })
    .returning({ id: details.id });
  publicDetailId = pub.id;

  await db.insert(details).values({ title: "Detaliu public vechi", authorId: author, createdAt: old });
  await db
    .insert(details)
    .values({ title: "Detaliu de proiect", authorId: author, projectId: p.id, createdAt: recent });
  await db
    .insert(details)
    .values({ title: "Detaliu retras", authorId: author, createdAt: recent, anonymizedAt: recent });
  const [draft] = await db
    .insert(details)
    .values({ title: "Detaliu ciornă", authorId: author, status: "DRAFT", createdAt: recent })
    .returning({ id: details.id });

  // Pe detaliul public: un comentariu de la altcineva (se numără), unul al autorului (NU), unul vechi (NU).
  await db.insert(comments).values({ targetType: "DETAIL", targetId: publicDetailId, authorId: other, body: "x", createdAt: recent });
  await db.insert(comments).values({ targetType: "DETAIL", targetId: publicDetailId, authorId: author, body: "y", createdAt: recent });
  await db.insert(comments).values({ targetType: "DETAIL", targetId: publicDetailId, authorId: other, body: "z", createdAt: old });
  // Dezaprobare de la altcineva: rând în `validations` + comentariu-justificare (originValidationId).
  // Comentariul NU trebuie numărat (altfel aceeași acțiune contează de 2 ori — vezi digestRepo).
  const [v] = await db
    .insert(validations)
    .values({ userId: other, targetType: "DETAIL", targetId: publicDetailId, position: "DISAPPROVE", createdAt: recent })
    .returning({ id: validations.id });
  await db.insert(comments).values({
    targetType: "DETAIL",
    targetId: publicDetailId,
    authorId: other,
    body: "justificare",
    originValidationId: v.id,
    createdAt: recent,
  });
  // Comentariu pe un detaliu DRAFT al autorului → NU se numără (digestul reflectă doar detalii publicate).
  await db
    .insert(comments)
    .values({ targetType: "DETAIL", targetId: draft.id, authorId: other, body: "pe ciornă", createdAt: recent });
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await db.delete(sketches);
  await db.delete(comments);
  await db.delete(validations);
  await db.delete(details);
  await db.delete(projects);
  await db.delete(roles);
  await db.delete(users);
});

// Regula aprobata: "Repara acum cele trei contoare" pentru "emailul numara contributii ascunse: aplicatia afiseaza 0, dar digestul raporteaza 1."
it("exclude activitatea ascunsa din toate cele trei contoare, pastrand activitatea vizibila", async () => {
  const owner = await makeUser("digest-hidden-owner@test.local", { role: false, digest: false });
  const [detail] = await db.insert(details).values({ authorId: owner, title: "Digest ascuns", createdAt: old }).returning();
  await db.insert(comments).values({ authorId: other, targetType: "DETAIL", targetId: detail.id, body: "ascuns", hiddenAfterRelease: true, createdAt: recent });
  await db.insert(sketches).values({ authorId: other, detailId: detail.id, status: "PUBLISHED", hiddenAfterRelease: true, createdAt: recent });
  await db.insert(validations).values({ userId: other, targetType: "DETAIL", targetId: detail.id, position: "APPROVE", hiddenAfterRelease: true, createdAt: recent });
  const counters = [countCommentsOnOwnDetails, countSketchesOnOwnDetails, countValidationsOnOwnDetails];
  expect(await Promise.all(counters.map(async (counter) => (await counter(since)).get(owner) ?? 0))).toEqual([0, 0, 0]);

  await db.insert(comments).values({ authorId: author, targetType: "DETAIL", targetId: detail.id, body: "vizibil", createdAt: recent });
  await db.insert(sketches).values({ authorId: author, detailId: detail.id, status: "PUBLISHED", createdAt: recent });
  await db.insert(validations).values({ userId: author, targetType: "DETAIL", targetId: detail.id, position: "APPROVE", createdAt: recent });
  expect(await Promise.all(counters.map(async (counter) => (await counter(since)).get(owner) ?? 0))).toEqual([1, 1, 1]);
});

describe("listDigestRecipients", () => {
  it("ACTIVI cu rol și flag true; exclude flag off / fără rol / suspendați", async () => {
    const ids = (await listDigestRecipients()).map((r) => r.id);
    expect(ids).toContain(author);
    expect(ids).toContain(other);
    expect(ids).toHaveLength(2);
  });
});

describe("countCommentsOnOwnDetails", () => {
  it("doar comentariile de la alții, din fereastră, pe detalii PUBLICATE; exclude justificările de dezaprobare și ciornele", async () => {
    const map = await countCommentsOnOwnDetails(since);
    // 1 comentariu real; justificarea de dezaprobare (originValidationId) și comentariul pe ciornă NU se numără.
    expect(map.get(author)).toBe(1);
    expect(map.has(other)).toBe(false);
  });
});

describe("listNewCommunityDetails", () => {
  it("doar detalii publice noi — exclude proiect, retras și cele din afara ferestrei", async () => {
    const rows = await listNewCommunityDetails(since, 10);
    expect(rows.map((r) => r.title)).toEqual(["Detaliu public"]);
  });
});

// "mai bine primeste mail lunea doar cine a avut activitate" — "daca la un user s-a raspuns la comentarii, schite etc"
it("numara o singura data raspunsurile la comentariile proprii pe detaliile altora, fara actiuni proprii sau continut ascuns", async () => {
  const host = await makeUser("digest-thread-host@test.local", { digest: false });
  const recipient = await makeUser("digest-thread-recipient@test.local", { digest: false });
  const [detail] = await db.insert(details).values({ authorId: host, title: "Fir extern", createdAt: old }).returning();
  const [root] = await db.insert(comments).values({ authorId: recipient, targetType: "DETAIL", targetId: detail.id, body: "Radacina", createdAt: old }).returning();
  const [reply] = await db.insert(comments).values({ authorId: other, targetType: "DETAIL", targetId: detail.id, parentCommentId: root.id, replyToCommentId: root.id, body: "Raspuns", createdAt: recent }).returning();
  await db.insert(comments).values({ authorId: recipient, targetType: "DETAIL", targetId: detail.id, parentCommentId: root.id, body: "Propriu", createdAt: recent });
  expect((await countCommentsOnOwnDetails(since)).get(recipient)).toBe(1);
  await db.update(comments).set({ hiddenAfterRelease: true }).where(eq(comments.id, reply.id));
  expect((await countCommentsOnOwnDetails(since)).get(recipient) ?? 0).toBe(0);
  await db.update(comments).set({ hiddenAfterRelease: false }).where(eq(comments.id, reply.id));
  await db.update(comments).set({ hiddenAfterRelease: true }).where(eq(comments.id, root.id));
  expect((await countCommentsOnOwnDetails(since)).get(recipient) ?? 0).toBe(0);
});

// "daca la un user s-a raspuns la comentarii, schite etc" — parintele direct primeste derivarea, nu toti stramosii.
it("include comentariile pe schita proprie si derivarile directe, respectand retragerea autorului", async () => {
  const host = await makeUser("digest-sketch-host@test.local", { digest: false });
  const recipient = await makeUser("digest-sketch-recipient@test.local", { digest: false });
  const [detail] = await db.insert(details).values({ authorId: host, title: "Schita externa", createdAt: old }).returning();
  const [base] = await db.insert(sketches).values({ authorId: recipient, detailId: detail.id, status: "PUBLISHED", createdAt: old }).returning();
  const [child] = await db.insert(sketches).values({ authorId: other, detailId: detail.id, status: "PUBLISHED", baseSketchIds: [base.id], createdAt: recent }).returning();
  await db.insert(sketches).values({ authorId: host, detailId: detail.id, status: "PUBLISHED", baseSketchIds: [base.id, child.id], createdAt: recent });
  await db.insert(sketches).values({ authorId: recipient, detailId: detail.id, status: "PUBLISHED", baseSketchIds: [base.id], createdAt: recent });
  await db.insert(comments).values({ authorId: other, targetType: "DETAIL", targetId: detail.id, sketchContextId: base.id, body: "Pe schita", createdAt: recent });
  expect((await countSketchesOnOwnDetails(since)).get(recipient)).toBe(1);
  expect((await countCommentsOnOwnDetails(since)).get(recipient)).toBe(1);
  await db.update(sketches).set({ authorRemoved: true }).where(eq(sketches.id, base.id));
  expect((await countSketchesOnOwnDetails(since)).get(recipient) ?? 0).toBe(0);
  expect((await countCommentsOnOwnDetails(since)).get(recipient) ?? 0).toBe(0);
});

// "daca la un user s-a raspuns la comentarii" — inclusiv un reply propriu intr-un fir inceput de altcineva.
it("include raspunsul adresat autorului unui reply, separat de autorul radacinii", async () => {
  const host = await makeUser("digest-target-host@test.local", { digest: false });
  const recipient = await makeUser("digest-target-recipient@test.local", { digest: false });
  const [detail] = await db.insert(details).values({ authorId: host, title: "Reply adresat", createdAt: old }).returning();
  const [root] = await db.insert(comments).values({ authorId: host, targetType: "DETAIL", targetId: detail.id, body: "Radacina", createdAt: old }).returning();
  const [target] = await db.insert(comments).values({ authorId: recipient, targetType: "DETAIL", targetId: detail.id, parentCommentId: root.id, body: "Reply propriu", createdAt: old }).returning();
  await db.insert(comments).values({ authorId: other, targetType: "DETAIL", targetId: detail.id, parentCommentId: root.id, replyToCommentId: target.id, body: "Raspuns adresat", createdAt: recent });
  expect((await countCommentsOnOwnDetails(since)).get(recipient)).toBe(1);
  expect((await countCommentsOnOwnDetails(since)).get(host)).toBe(1);
});

// "daca la un user s-a raspuns la comentarii, schite etc"; accesul DESTINATARULUI se verifica la trimitere.
it("exclude activitatea dintr-un proiect dupa retragerea accesului destinatarului", async () => {
  const host = await makeUser("digest-project-host@test.local", { digest: false });
  const recipient = await makeUser("digest-project-recipient@test.local", { digest: false });
  const [project] = await db.insert(projects).values({ ownerId: host, name: "Proiect digest", inviteToken: crypto.randomUUID() }).returning();
  await db.insert(projectMembers).values({ projectId: project.id, userId: recipient });
  const [detail] = await db.insert(details).values({ authorId: host, projectId: project.id, title: "Privat", createdAt: old }).returning();
  const [root] = await db.insert(comments).values({ authorId: recipient, targetType: "DETAIL", targetId: detail.id, body: "Radacina privata", createdAt: old }).returning();
  const [base] = await db.insert(sketches).values({ authorId: recipient, detailId: detail.id, status: "PUBLISHED", createdAt: old }).returning();
  await db.insert(comments).values({ authorId: other, targetType: "DETAIL", targetId: detail.id, parentCommentId: root.id, body: "Raspuns privat", createdAt: recent });
  await db.insert(sketches).values({ authorId: other, detailId: detail.id, status: "PUBLISHED", baseSketchIds: [base.id], createdAt: recent });
  expect((await countCommentsOnOwnDetails(since)).get(recipient)).toBe(1);
  expect((await countSketchesOnOwnDetails(since)).get(recipient)).toBe(1);
  await db.update(projectMembers).set({ removedAt: now }).where(eq(projectMembers.projectId, project.id));
  expect((await countCommentsOnOwnDetails(since)).get(recipient) ?? 0).toBe(0);
  expect((await countSketchesOnOwnDetails(since)).get(recipient) ?? 0).toBe(0);
});

// "mai bine primeste mail lunea doar cine a avut activitate"; "Activeaza implicit, pastreaza dezabonarile"
it("DB → agregare → template → lot: raspunsul extern declanseaza digestul, dezabonarea il opreste", async () => {
  vi.stubEnv("AUTH_SECRET", "digest-integration-fixture-not-a-real-secret");
  const recipient = await makeUser("digest-delivery-recipient@test.local");
  const [detail] = await db.insert(details).values({ authorId: other, title: "Integrare digest", createdAt: old }).returning();
  const [root] = await db.insert(comments).values({ authorId: recipient, targetType: "DETAIL", targetId: detail.id, body: "Contributie", createdAt: old }).returning();
  vi.mocked(sendEmailBatch).mockClear();
  await sendWeeklyDigests(now);
  expect(vi.mocked(sendEmailBatch).mock.calls.flatMap(([messages]) => messages).some((message) => message.to === "digest-delivery-recipient@test.local")).toBe(false);
  await db.insert(comments).values({ authorId: other, targetType: "DETAIL", targetId: detail.id, parentCommentId: root.id, body: "Raspuns extern", createdAt: recent });
  vi.mocked(sendEmailBatch).mockClear();
  await sendWeeklyDigests(now);
  const message = vi.mocked(sendEmailBatch).mock.calls.flatMap(([messages]) => messages).find((item) => item.to === "digest-delivery-recipient@test.local");
  expect(message?.html).toContain("un comentariu nou");
  expect(message?.text).toContain("comentariile sau schițele tale");
  await db.update(users).set({ weeklyDigestEnabled: false }).where(eq(users.id, recipient));
  vi.mocked(sendEmailBatch).mockClear();
  await sendWeeklyDigests(now);
  expect(vi.mocked(sendEmailBatch).mock.calls.flatMap(([messages]) => messages).some((item) => item.to === "digest-delivery-recipient@test.local")).toBe(false);
});
