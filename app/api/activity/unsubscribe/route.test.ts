import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/server/repos/usersRepo", () => ({ disableActivityEmails: vi.fn() }));
import { createSignedToken } from "@/lib/signed-token";
import { disableActivityEmails } from "@/server/repos/usersRepo";
import { GET, POST } from "./route";
const userId = "11111111-1111-4111-8111-111111111111";
const url = "https://detalia.ro/api/activity/unsubscribe";
function post(token: string) { const body = new FormData(); body.set("token", token); return new Request(url, { method: "POST", body }); }
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("AUTH_SECRET", "fixture-signing-key-only-not-production"); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
// "GET arata o pagina cu buton, POST executa" — scanerele de linkuri nu pot dezabona.
it("GET valid nu scrie; POST modifica doar preferinta userului semnat", async () => {
  const token = createSignedToken("activity-unsubscribe", userId);
  expect((await GET(new Request(`${url}?token=${token}`))).status).toBe(200);
  expect(disableActivityEmails).not.toHaveBeenCalled();
  expect((await POST(post(token))).status).toBe(200);
  expect(disableActivityEmails).toHaveBeenCalledExactlyOnceWith(userId);
});
// "PURPOSE separat"; "nu modifica implicit digestul saptamanal".
it.each(["digest-unsubscribe", "other-purpose"])("un token %s nu autorizeaza schimbarea", async (purpose) => {
  expect((await POST(post(createSignedToken(purpose, userId)))).status).toBe(400);
  expect(disableActivityEmails).not.toHaveBeenCalled();
});
// "Tokenul expira"; "fara IDOR".
it("token modificat sau expirat nu scrie nimic", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
  const token = createSignedToken("activity-unsubscribe", userId);
  expect((await POST(post(token.replace(userId, "22222222-2222-4222-8222-222222222222")))).status).toBe(400);
  vi.setSystemTime(new Date("2026-04-01T10:00:00Z"));
  expect((await POST(post(token))).status).toBe(400); expect(disableActivityEmails).not.toHaveBeenCalled();
});
