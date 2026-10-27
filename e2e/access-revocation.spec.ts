import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { comments, details, projects, sketches } from "../db/schema";
import { addComment, toggleCommentLike } from "../server/services/commentService";
import { createProject, joinProjectByToken, removeMember } from "../server/services/projectService";
import { approve, disapprove } from "../server/services/validationService";
import { getSeed } from "./seed";

// Regula aprobata: "Eliminarea membrului invalideaza automat invitatia veche."
test("DET-01: join concurent cu eliminarea nu reactiveaza invitatia veche", async () => {
  const { testerUserId: owner, authorUserId: member } = getSeed();
  const created = await createProject({ ownerId: owner, name: "E2E revocare " + randomUUID() });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error("Project fixture failed");
  try {
    expect((await joinProjectByToken({ token: created.inviteToken, userId: member })).ok).toBe(true);
    await Promise.all([
      removeMember({ projectId: created.projectId, requesterId: owner, targetUserId: member }),
      joinProjectByToken({ token: created.inviteToken, userId: member }),
    ]);
    expect(await joinProjectByToken({ token: created.inviteToken, userId: member })).toEqual({ ok: false, error: "INVALID_TOKEN" });
    const { isActiveMember } = await import("../server/repos/projectMembersRepo");
    expect(await isActiveMember(created.projectId, member)).toBe(false);
  } finally {
    await db.delete(projects).where(eq(projects.id, created.projectId));
  }
});

// Regula aprobata: "Contributiile ascunse nu pot fi votate sau primi raspunsuri."
test("DET-04: service-urile refuza vot/reply pe contributii ascunse chiar cu ID valid", async () => {
  const { testerUserId: owner, authorUserId: contributor } = getSeed();
  const [detail] = await db.insert(details).values({ authorId: owner, title: "E2E ascuns", status: "PUBLISHED" }).returning();
  const [sketch] = await db.insert(sketches).values({ authorId: contributor, detailId: detail.id, status: "PUBLISHED", hiddenAfterRelease: true }).returning();
  const [comment] = await db.insert(comments).values({ authorId: contributor, targetType: "DETAIL", targetId: detail.id, body: "Ascuns", hiddenAfterRelease: true }).returning();
  try {
    const target = { userId: owner, targetType: "SKETCH" as const, targetId: sketch.id };
    expect(await approve(target)).toEqual({ ok: false, error: "TARGET_NOT_FOUND" });
    expect(await disapprove({ ...target, justification: "Motiv" })).toEqual({ ok: false, error: "TARGET_NOT_FOUND" });
    expect(await addComment({ ...target, body: "Raspuns" })).toEqual({ ok: false, error: "TARGET_NOT_FOUND" });
    expect(await addComment({ userId: owner, targetType: "DETAIL", targetId: detail.id, parentCommentId: comment.id, body: "Reply" })).toEqual({ ok: false, error: "INVALID_PARENT" });
    expect(await toggleCommentLike({ userId: owner, commentId: comment.id, direction: "UP" })).toEqual({ ok: false, error: "NOT_FOUND" });
  } finally {
    await db.delete(comments).where(eq(comments.targetId, detail.id));
    await db.delete(sketches).where(eq(sketches.id, sketch.id));
    await db.delete(details).where(eq(details.id, detail.id));
  }
});
