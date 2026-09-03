import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// SQL real (PGlite) pentru firul de reply aplatizat: `getThreadCommentForTarget` rezolvă rădăcina
// pentru orice comentariu din fir, iar `listCommentsForTarget` aduce numele celui căruia i s-a
// răspuns prin self-join (alias, nu subquery corelat).
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const schema = await import("@/db/schema");
  const { db } = await createTestDb();
  return { db, schema };
});

const { db } = await import("@/db");
const { users, details, comments } = await import("@/db/schema");
const { getThreadCommentForTarget, listCommentsForTarget, insertComment } = await import("./commentsRepo");

let u1: string;
let u2: string;
let detailId: string;
let otherDetailId: string;
let rootId: string;
let replyId: string;

beforeAll(async () => {
  const [a] = await db.insert(users).values({ email: "cr-u1@test.local", name: "Ana" }).returning({ id: users.id });
  const [b] = await db.insert(users).values({ email: "cr-u2@test.local", name: "Bogdan" }).returning({ id: users.id });
  u1 = a.id;
  u2 = b.id;

  const [d] = await db.insert(details).values({ title: "D", authorId: u1 }).returning({ id: details.id });
  detailId = d.id;
  const [o] = await db.insert(details).values({ title: "O", authorId: u1 }).returning({ id: details.id });
  otherDetailId = o.id;

  const root = await insertComment({ targetType: "DETAIL", targetId: detailId, authorId: u1, body: "rădăcină" });
  rootId = root.id;
  // Reply la rădăcină (replyToCommentId null).
  const reply = await insertComment({
    targetType: "DETAIL",
    targetId: detailId,
    authorId: u2,
    body: "reply",
    parentCommentId: rootId,
  });
  replyId = reply.id;
  // Reply la reply-ul lui Bogdan: parent = rădăcina firului, replyToCommentId = reply-ul.
  await insertComment({
    targetType: "DETAIL",
    targetId: detailId,
    authorId: u1,
    body: "reply la reply",
    parentCommentId: rootId,
    replyToCommentId: replyId,
  });
});

afterAll(async () => {
  await db.delete(comments);
  await db.delete(details);
  await db.delete(users);
});

describe("getThreadCommentForTarget", () => {
  it("pe rădăcină → rootId = id-ul ei", async () => {
    const t = await getThreadCommentForTarget(rootId, "DETAIL", detailId);
    expect(t).toEqual({ id: rootId, authorId: u1, rootId });
  });

  it("pe un reply → rootId = rădăcina firului", async () => {
    const t = await getThreadCommentForTarget(replyId, "DETAIL", detailId);
    expect(t).toEqual({ id: replyId, authorId: u2, rootId });
  });

  it("comentariu de pe altă țintă → null", async () => {
    expect(await getThreadCommentForTarget(rootId, "DETAIL", otherDetailId)).toBeNull();
  });
});

describe("listCommentsForTarget — eticheta catre <Nume>", () => {
  it("reply-la-reply poartă numele autorului reply-ului țintă; reply-la-rădăcină nu", async () => {
    const rows = await listCommentsForTarget("DETAIL", detailId);
    const replyToReply = rows.find((r) => r.body === "reply la reply");
    const replyToRoot = rows.find((r) => r.body === "reply");
    expect(replyToReply?.replyToAuthorName).toBe("Bogdan");
    expect(replyToRoot?.replyToCommentId).toBeNull();
    expect(replyToRoot?.replyToAuthorName).toBeNull();
  });
});
