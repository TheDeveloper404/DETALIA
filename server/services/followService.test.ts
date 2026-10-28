import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/server/repos/followsRepo", () => ({
  followTargetExists: vi.fn(),
  isFollowing: vi.fn(),
  setFollowing: vi.fn(),
}));
import { followTargetExists, setFollowing } from "@/server/repos/followsRepo";
import { setFollow } from "./followService";
const userId = "11111111-1111-4111-8111-111111111111",
  targetId = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(followTargetExists).mockResolvedValue(true);
});
// **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. Filtrul „Urmariti” include detaliile unui autor urmarit SAU ale unei categorii urmarite, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de user urmarit.
it.each([
  { kind: "NOPE", targetId, followed: true },
  { kind: "USER", targetId: "x", followed: true },
  { kind: "USER", targetId: userId, followed: true },
  { kind: "USER", targetId, followed: "false" },
])("respinge input invalid sau self-follow: %j", async (input) => {
  expect(await setFollow({ userId, ...input })).toEqual({ ok: false });
  expect(setFollowing).not.toHaveBeenCalled();
});
// **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. Filtrul „Urmariti” include detaliile unui autor urmarit SAU ale unei categorii urmarite, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de user urmarit.
it("nu urmareste tinte absente, suspendate sau grupari de categorii", async () => {
  vi.mocked(followTargetExists).mockResolvedValue(false);
  expect(await setFollow({ userId, kind: "CATEGORY", targetId, followed: true })).toEqual({
    ok: false,
  });
  expect(setFollowing).not.toHaveBeenCalled();
});
// **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. Filtrul „Urmariti” include detaliile unui autor urmarit SAU ale unei categorii urmarite, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de user urmarit.
it("unfollow ramane posibil dupa disparitia tintei, scoped pe userul apelant", async () => {
  expect(await setFollow({ userId, kind: "USER", targetId, followed: false })).toEqual({
    ok: true,
    followed: false,
  });
  expect(setFollowing).toHaveBeenCalledWith(userId, "USER", targetId, false);
  expect(followTargetExists).not.toHaveBeenCalled();
});
