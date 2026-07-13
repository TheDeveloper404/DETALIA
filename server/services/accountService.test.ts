import { describe, expect, it, vi } from "vitest";

const { setUserStatus: setUserStatusRow } = vi.hoisted(() => ({
  setUserStatus: vi.fn(),
}));

vi.mock("@/server/repos/usersRepo", () => ({
  setUserStatus: setUserStatusRow,
  anonymizeUserRow: vi.fn(),
  deleteUserAuth: vi.fn(),
  getUserMedia: vi.fn(),
}));

vi.mock("@/server/repos/rolesRepo", () => ({ clearRoleVerification: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));

import { setUserStatus } from "./accountService";

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
