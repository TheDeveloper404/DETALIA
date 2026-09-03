import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repos/commentsRepo", () => ({
  deleteFreeCommentByAuthor: vi.fn(),
  getCommentTarget: vi.fn(),
  getThreadCommentForTarget: vi.fn(),
  insertComment: vi.fn(),
  listCommentsForTarget: vi.fn(),
  toggleCommentLike: vi.fn(),
  updateCommentByAuthor: vi.fn(),
}));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/server/repos/sketchesRepo", () => ({ filterSketchIdsByDetail: vi.fn() }));
vi.mock("@/server/services/validationService", () => ({ targetExists: vi.fn() }));
vi.mock("@/lib/image-processing", () => ({ reprocessBlobImage: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));

import { reprocessBlobImage } from "@/lib/image-processing";
import { deleteBlobs } from "@/lib/storage";
import { deleteFreeCommentByAuthor, insertComment } from "@/server/repos/commentsRepo";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import { targetExists } from "@/server/services/validationService";

import { addComment, deleteComment } from "./commentService";

const USER = "u-1";
const COMMENT_ID = "22222222-2222-4222-8222-222222222222";
const DETAIL_ID = "11111111-1111-4111-8111-111111111111";
const base = { userId: USER, targetType: "DETAIL" as const, targetId: DETAIL_ID, body: "text" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRoleByUserId).mockResolvedValue({
    roleMain: "EXECUTANT",
    subRole: null,
    verificationStatus: "UNVERIFIED",
  } as never);
  vi.mocked(targetExists).mockResolvedValue(true as never);
});

describe("addComment — imagine atașată", () => {
  it("URL-ul primit NU se persistă direct: se salvează doar rezultatul re-procesării server-side", async () => {
    vi.mocked(reprocessBlobImage).mockResolvedValue({ ok: true, url: "https://blob/curat.webp" } as never);

    const res = await addComment({ ...base, imageUrl: "https://blob/u/u-1/comments/brut.png" });

    expect(res).toEqual({ ok: true });
    expect(reprocessBlobImage).toHaveBeenCalledWith(
      "https://blob/u/u-1/comments/brut.png",
      "comments",
      USER,
    );
    expect(vi.mocked(insertComment).mock.calls[0][0]).toMatchObject({
      imageUrl: "https://blob/curat.webp",
    });
  });

  it("URL respins de pipeline (al altui user / imagine invalidă) → comentariul se salvează FĂRĂ poză", async () => {
    vi.mocked(reprocessBlobImage).mockResolvedValue({ ok: false } as never);

    const res = await addComment({ ...base, imageUrl: "https://blob/u/ALT-USER/comments/x.png" });

    expect(res).toEqual({ ok: true });
    expect(vi.mocked(insertComment).mock.calls[0][0]).toMatchObject({ imageUrl: null });
  });

  it("fără imagine → nu atinge deloc pipeline-ul de upload", async () => {
    await addComment(base);

    expect(reprocessBlobImage).not.toHaveBeenCalled();
    expect(vi.mocked(insertComment).mock.calls[0][0]).toMatchObject({ imageUrl: null });
  });

  it("corp invalid → nu se procesează nicio imagine (validarea vine prima)", async () => {
    const res = await addComment({ ...base, body: "   ", imageUrl: "https://blob/u/u-1/comments/x.png" });

    expect(res.ok).toBe(false);
    expect(reprocessBlobImage).not.toHaveBeenCalled();
    expect(insertComment).not.toHaveBeenCalled();
  });
});

describe("deleteComment — curățarea fișierului", () => {
  it("comentariu cu poză șters → fișierul se șterge din Blob", async () => {
    vi.mocked(deleteFreeCommentByAuthor).mockResolvedValue({
      deleted: true,
      imageUrl: "https://blob/curat.webp",
    } as never);

    const res = await deleteComment({ userId: USER, commentId: COMMENT_ID });

    expect(res).toEqual({ ok: true });
    expect(deleteBlobs).toHaveBeenCalledWith(["https://blob/curat.webp"]);
  });

  it("comentariu care nu e al userului → NOT_FOUND, fără ștergere de fișier", async () => {
    vi.mocked(deleteFreeCommentByAuthor).mockResolvedValue({ deleted: false, imageUrl: null } as never);

    const res = await deleteComment({ userId: USER, commentId: COMMENT_ID });

    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(deleteBlobs).not.toHaveBeenCalled();
  });
});
