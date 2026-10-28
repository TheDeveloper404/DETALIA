import { beforeEach, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/require-active-user", () => ({ requireActiveUserId: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkLimit: vi.fn(), limiters: { mutation: "mutation" } }));
vi.mock("@/server/services/followService", () => ({ setFollow: vi.fn() }));
import { requireActiveUserId } from "@/lib/require-active-user";
import { checkLimit } from "@/lib/rate-limit";
import { setFollow } from "@/server/services/followService";
import { setFollowAction } from "./actions";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireActiveUserId).mockResolvedValue("session-user");
  vi.mocked(checkLimit).mockResolvedValue({ ok: true } as never);
  vi.mocked(setFollow).mockResolvedValue({ ok: true, followed: true });
});
// **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. Filtrul „Urmariti” include detaliile unui autor urmarit SAU ale unei categorii urmarite, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de user urmarit.
it("transmite numai userul verificat de guard", async () => {
  await setFollowAction("USER", "target", true);
  expect(setFollow).toHaveBeenCalledWith({
    userId: "session-user",
    kind: "USER",
    targetId: "target",
    followed: true,
  });
});
// **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. Filtrul „Urmariti” include detaliile unui autor urmarit SAU ale unei categorii urmarite, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de user urmarit.
it("sesiune expirata sau suspendata: guard-ul opreste mutatia", async () => {
  vi.mocked(requireActiveUserId).mockRejectedValue(new Error("NEXT_REDIRECT"));
  await expect(setFollowAction("USER", "target", true)).rejects.toThrow("NEXT_REDIRECT");
  expect(setFollow).not.toHaveBeenCalled();
});
// **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. Filtrul „Urmariti” include detaliile unui autor urmarit SAU ale unei categorii urmarite, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de user urmarit.
it("rate limit nu modifica relatia", async () => {
  vi.mocked(checkLimit).mockResolvedValue({ ok: false } as never);
  expect((await setFollowAction("USER", "target", true)).ok).toBe(false);
  expect(setFollow).not.toHaveBeenCalled();
});
// **Urmarire:** userul poate urmari/opri urmarirea unui user sau a unei categorii; setarea aceleiasi stari repetat nu o inverseaza. Filtrul „Urmariti” include detaliile unui autor urmarit SAU ale unei categorii urmarite, cu vizibilitatea si ordinea cronologica existente. Identitatea unui autor anonimizat nu poate fi dedusa prin filtrul de user urmarit.
it("erorile DB sunt generice si permit reincercarea", async () => {
  vi.mocked(setFollow).mockRejectedValue(new Error("secret SQL connection"));
  const result = await setFollowAction("USER", "target", true);
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain("secret SQL");
});
