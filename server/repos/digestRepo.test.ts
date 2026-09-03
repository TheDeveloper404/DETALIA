import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// SQL real (PGlite) pentru digestRepo — mock-ul nu poate garanta că `listNewCommunityDetails` chiar
// exclude detaliile de proiect (invariantul transversal din CLAUDE.md) sau că numărătorile grupează
// corect pe autorul detaliului. Un singur set de date seed, verificat pe toate query-urile.
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const schema = await import("@/db/schema");
  const { db } = await createTestDb();
  return { db, schema };
});

const { db } = await import("@/db");
const { users, roles, details, projects, comments, validations } = await import("@/db/schema");
const { listDigestRecipients, countCommentsOnOwnDetails, listNewCommunityDetails } = await import(
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
  await db.delete(comments);
  await db.delete(validations);
  await db.delete(details);
  await db.delete(projects);
  await db.delete(roles);
  await db.delete(users);
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
