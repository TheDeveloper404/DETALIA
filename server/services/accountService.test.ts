import { describe, expect, it, vi } from "vitest";

const { setUserStatus: setUserStatusRow } = vi.hoisted(() => ({
  setUserStatus: vi.fn(),
}));

vi.mock("@/server/repos/usersRepo", () => ({
  setUserStatus: setUserStatusRow,
  anonymizeUserRow: vi.fn(),
  deleteUserAuth: vi.fn(),
  getUserMedia: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/server/repos/rolesRepo", () => ({ clearRoleVerification: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));
vi.mock("@/server/services/projectService", () => ({
  reassignOrDeleteOwnedProjectsOnAccountDeletion: vi.fn(),
}));

import { deleteBlobs } from "@/lib/storage";
import { clearRoleVerification } from "@/server/repos/rolesRepo";
import { anonymizeUserRow, deleteUserAuth, getUserMedia } from "@/server/repos/usersRepo";
import { reassignOrDeleteOwnedProjectsOnAccountDeletion } from "@/server/services/projectService";

import { deleteAccount, setUserStatus } from "./accountService";

describe("setUserStatus (suspendare/reactivare admin)", () => {
  it("suspendă un cont existent → ok cu email", async () => {
    setUserStatusRow.mockResolvedValueOnce({ id: "u1", email: "user@x.ro" });

    const result = await setUserStatus("u1", "SUSPENDED");

    expect(setUserStatusRow).toHaveBeenCalledWith("u1", "SUSPENDED");
    expect(result).toEqual({ ok: true, email: "user@x.ro" });
  });

  it("reactivează un cont suspendat → ok", async () => {
    setUserStatusRow.mockResolvedValueOnce({ id: "u1", email: "user@x.ro" });

    const result = await setUserStatus("u1", "ACTIVE");

    expect(setUserStatusRow).toHaveBeenCalledWith("u1", "ACTIVE");
    expect(result.ok).toBe(true);
  });

  it("cont inexistent SAU deja DELETED (repo întoarce null) → NOT_FOUND", async () => {
    setUserStatusRow.mockResolvedValueOnce(null);

    const result = await setUserStatus("u-deleted", "ACTIVE");

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});

describe("deleteAccount (GDPR)", () => {
  it("reasignează/șterge proiectele deținute ÎNAINTE de anonimizare (userId încă e owner-ul real)", async () => {
    const order: string[] = [];
    vi.mocked(reassignOrDeleteOwnedProjectsOnAccountDeletion).mockImplementationOnce(async () => {
      order.push("reassign");
    });
    vi.mocked(anonymizeUserRow).mockImplementationOnce(async () => {
      order.push("anonymize");
    });

    const result = await deleteAccount("u1");

    expect(reassignOrDeleteOwnedProjectsOnAccountDeletion).toHaveBeenCalledWith("u1");
    expect(order).toEqual(["reassign", "anonymize"]);
    expect(clearRoleVerification).toHaveBeenCalledWith("u1");
    expect(deleteUserAuth).toHaveBeenCalledWith("u1");
    expect(result).toEqual({ ok: true });
  });

  it("șterge avatarul + coperta din Blob (best-effort)", async () => {
    vi.mocked(getUserMedia).mockResolvedValueOnce({ image: "https://blob/a.png", coverImage: "https://blob/c.png" } as never);
    await deleteAccount("u1");
    expect(deleteBlobs).toHaveBeenCalledWith(["https://blob/a.png", "https://blob/c.png"]);
  });
});
