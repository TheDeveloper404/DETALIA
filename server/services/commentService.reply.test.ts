import { beforeEach, describe, expect, it, vi } from "vitest";

// Reply stil LinkedIn — fir aplatizat: `parentCommentId` din DB = MEREU rădăcina firului, iar
// `replyToCommentId` = comentariul concret la care s-a apăsat „Răspunde" (null dacă e chiar rădăcina).
// Regula: nu se poate da reply peste un comentariu de pe altă țintă (INVALID_PARENT).
const repo = vi.hoisted(() => ({
  deleteFreeCommentByAuthor: vi.fn(),
  getCommentTarget: vi.fn(),
  getThreadCommentForTarget: vi.fn(),
  insertComment: vi.fn(),
  listCommentsForTarget: vi.fn(),
  toggleCommentLike: vi.fn(),
  updateCommentByAuthor: vi.fn(),
}));
vi.mock("@/server/repos/commentsRepo", () => repo);
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/server/repos/sketchesRepo", () => ({ filterSketchIdsByDetail: vi.fn() }));
vi.mock("@/server/services/validationService", () => ({ targetExists: vi.fn() }));
vi.mock("@/lib/image-processing", () => ({ reprocessBlobImage: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));

import { getRoleByUserId } from "@/server/repos/rolesRepo";
import { targetExists } from "@/server/services/validationService";

import { addComment } from "./commentService";

const USER = "u-1";
const DETAIL = "11111111-1111-4111-8111-111111111111";
const ROOT = "22222222-2222-4222-8222-222222222222";
const REPLY = "33333333-3333-4333-8333-333333333333";
const base = { userId: USER, targetType: "DETAIL" as const, targetId: DETAIL, body: "text" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRoleByUserId).mockResolvedValue({
    roleMain: "EXECUTANT",
    subRole: null,
    verificationStatus: "UNVERIFIED",
  } as never);
  vi.mocked(targetExists).mockResolvedValue(true as never);
});

describe("addComment — reply aplatizat", () => {
  it("răspuns la RĂDĂCINĂ → parentCommentId = rădăcina, replyToCommentId = null", async () => {
    repo.getThreadCommentForTarget.mockResolvedValue({ id: ROOT, authorId: "a-root", rootId: ROOT });

    const res = await addComment({ ...base, parentCommentId: ROOT });

    expect(res).toEqual({ ok: true });
    expect(repo.insertComment.mock.calls[0][0]).toMatchObject({
      parentCommentId: ROOT,
      replyToCommentId: null,
    });
  });

  it("răspuns la un REPLY → parentCommentId = rădăcina firului, replyToCommentId = reply-ul", async () => {
    repo.getThreadCommentForTarget.mockResolvedValue({ id: REPLY, authorId: "a-reply", rootId: ROOT });

    const res = await addComment({ ...base, parentCommentId: REPLY });

    expect(res).toEqual({ ok: true });
    expect(repo.insertComment.mock.calls[0][0]).toMatchObject({
      parentCommentId: ROOT,
      replyToCommentId: REPLY,
    });
  });

  it("comentariu-părinte de pe altă țintă / inexistent → INVALID_PARENT, fără insert", async () => {
    repo.getThreadCommentForTarget.mockResolvedValue(null);

    const res = await addComment({ ...base, parentCommentId: ROOT });

    expect(res).toEqual({ ok: false, error: "INVALID_PARENT" });
    expect(repo.insertComment).not.toHaveBeenCalled();
  });

  it("parentCommentId malformat → INVALID_PARENT înainte de orice query", async () => {
    const res = await addComment({ ...base, parentCommentId: "nu-e-uuid" });

    expect(res).toEqual({ ok: false, error: "INVALID_PARENT" });
    expect(repo.getThreadCommentForTarget).not.toHaveBeenCalled();
    expect(repo.insertComment).not.toHaveBeenCalled();
  });
});
