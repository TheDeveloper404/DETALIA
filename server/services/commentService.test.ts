import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repos/commentsRepo", () => ({
  getCommentTarget: vi.fn(),
  toggleCommentLike: vi.fn(),
}));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));

import { getCommentTarget, toggleCommentLike as toggleCommentLikeRepo } from "@/server/repos/commentsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";

import { toggleCommentLike } from "./commentService";

const ROLE = { roleMain: "EXECUTANT", subRole: null, verificationStatus: "UNVERIFIED" };
const commentId = "22222222-2222-4222-8222-222222222222";
const input = { userId: "u-1", commentId };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRoleByUserId).mockResolvedValue(ROLE as never);
  vi.mocked(getCommentTarget).mockResolvedValue({
    targetType: "DETAIL",
    targetId: "d-1",
    authorId: "owner-x",
  } as never);
  vi.mocked(toggleCommentLikeRepo).mockResolvedValue(true);
});

describe("SEC-11 — commentId malformat → NOT_FOUND, fără atingere DB", () => {
  it("commentId ne-UUID → NOT_FOUND, fără getRoleByUserId/toggle", async () => {
    const r = await toggleCommentLike({ ...input, commentId: "not-a-uuid" });
    expect(r).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(getRoleByUserId).not.toHaveBeenCalled();
    expect(toggleCommentLikeRepo).not.toHaveBeenCalled();
  });
});

describe("rol declarat obligatoriu — ca la comentat/validat", () => {
  it("fără rol → NO_ROLE, fără toggle", async () => {
    vi.mocked(getRoleByUserId).mockResolvedValue(null as never);
    const r = await toggleCommentLike(input);
    expect(r).toEqual({ ok: false, error: "NO_ROLE" });
    expect(toggleCommentLikeRepo).not.toHaveBeenCalled();
  });
});

describe("comentariul trebuie să existe", () => {
  it("comentariu inexistent → NOT_FOUND, fără toggle", async () => {
    vi.mocked(getCommentTarget).mockResolvedValue(null);
    const r = await toggleCommentLike(input);
    expect(r).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(toggleCommentLikeRepo).not.toHaveBeenCalled();
  });
});

describe("nu-ți poți aprecia propriul comentariu — CANNOT_LIKE_OWN (enforce pe server)", () => {
  it("autorul comentariului = userul care apreciază → CANNOT_LIKE_OWN, fără toggle", async () => {
    vi.mocked(getCommentTarget).mockResolvedValue({
      targetType: "DETAIL",
      targetId: "d-1",
      authorId: input.userId,
    } as never);
    const r = await toggleCommentLike(input);
    expect(r).toEqual({ ok: false, error: "CANNOT_LIKE_OWN" });
    expect(toggleCommentLikeRepo).not.toHaveBeenCalled();
  });
});

describe("toggle — o singură poziție per user per comentariu, reversibilă", () => {
  it("comentariu ne-apreciat încă → apreciază (liked: true)", async () => {
    vi.mocked(toggleCommentLikeRepo).mockResolvedValue(true);
    const r = await toggleCommentLike(input);
    expect(r).toEqual({ ok: true, liked: true });
    expect(toggleCommentLikeRepo).toHaveBeenCalledWith(commentId, input.userId);
  });

  it("comentariu deja apreciat → retrage aprecierea (liked: false)", async () => {
    vi.mocked(toggleCommentLikeRepo).mockResolvedValue(false);
    const r = await toggleCommentLike(input);
    expect(r).toEqual({ ok: true, liked: false });
  });
});
