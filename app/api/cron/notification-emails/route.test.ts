import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/server/services/notificationEmailService", () => ({ processNotificationEmails: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
import { processNotificationEmails } from "@/server/services/notificationEmailService";
import { GET } from "./route";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("CRON_SECRET", "fixture-only"); });
afterEach(() => vi.unstubAllEnvs());
// "Handler cron subtire cu CRON_SECRET dupa precedent" — deny by default, nu sesiune de user.
it.each([undefined, "Bearer wrong", "Bearer fixture-only-extra"])("respinge autorizarea invalida %s", async (authorization) => {
  const result = await GET(new Request("https://test.invalid/api/cron/notification-emails", { headers: authorization ? { authorization } : {} }));
  expect(result.status).toBe(401); expect(processNotificationEmails).not.toHaveBeenCalled();
});
// "Handler cron subtire cu CRON_SECRET dupa precedent".
it("deleaga o singura procesare si nu expune date personale", async () => {
  vi.mocked(processNotificationEmails).mockResolvedValue({ claimed: 1, sent: 1, skipped: 0, failed: 0 });
  const result = await GET(new Request("https://test.invalid/api/cron/notification-emails", { headers: { authorization: "Bearer fixture-only" } }));
  expect(await result.json()).toEqual({ ok: true, claimed: 1, sent: 1, skipped: 0, failed: 0 });
});
it("esecul intern nu expune eroarea SQL", async () => {
  vi.mocked(processNotificationEmails).mockRejectedValue(new Error("private SQL credentials"));
  const result = await GET(new Request("https://test.invalid/api/cron/notification-emails", { headers: { authorization: "Bearer fixture-only" } }));
  expect(result.status).toBe(500); expect(await result.text()).not.toContain("private SQL");
});
// "Fail-closed daca secretul lipseste din env."
it("fara CRON_SECRET nu proceseaza nimic", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await GET(new Request("https://test.invalid/api/cron/notification-emails", { headers: { authorization: "Bearer fixture-only" } }))).status).toBe(401);
  expect(processNotificationEmails).not.toHaveBeenCalled();
});
