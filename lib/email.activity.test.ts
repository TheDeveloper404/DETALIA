import { afterEach, expect, it, vi } from "vitest";
import { activityEmailHtml, activityEmailText, sendEmail } from "./email";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("escapeaza titlurile in HTML si pastreaza un link de dezabonare", () => {
  const data = { items: [{ title: "<img src=x onerror=alert(1)>", url: "https://detalia.ro/details/test", events: ["1 comentariu nou"] }], unsubscribeUrl: "https://detalia.ro/api/activity/unsubscribe?token=fixture" };
  const html = activityEmailHtml(data);
  expect(html).toContain("&lt;img src=x"); expect(html).not.toContain("<img src=x");
  expect(html).toContain(data.unsubscribeUrl); expect(activityEmailText(data)).toContain("1 comentariu nou");
});
// "Acelasi payload, aceeasi cheie" — inclusiv expeditorul initial, daca env se schimba intre incercari.
it("transportul trimite cheia de idempotenta si expeditorul din snapshot", async () => {
  vi.stubEnv("AUTH_RESEND_KEY", "fixture-only"); vi.stubEnv("EMAIL_FROM", "changed@test.invalid");
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetchMock);
  await sendEmail({ to: "recipient@test.invalid", from: "snapshot@test.invalid", subject: "Activitate", html: "<p>Test</p>", idempotencyKey: "delivery/fixture" });
  const request = fetchMock.mock.calls[0][1];
  expect(request.headers["Idempotency-Key"]).toBe("delivery/fixture");
  expect(JSON.parse(request.body).from).toBe("snapshot@test.invalid");
});
