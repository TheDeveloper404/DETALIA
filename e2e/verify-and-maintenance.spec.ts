import { gunzipSync } from "node:zlib";

import { expect, test } from "@playwright/test";

// E2E — /verify (pas intermediar anti-prefetch al magic link-ului de USER) și /maintenance (ecranul
// static de mentenanță). Anonim, fără DB. NU testăm consumul real al unui token Auth.js (necesită email
// real din Resend) — doar ramurile deterministe: lipsă param, și SEC-03 (anti open-redirect).

test.describe("/verify", () => {
  // PII (email, tokenuri, OTP, dovezi rol) **nu se loghează** — doar metadate.
  test("PostHog nu trimite callback-ul magic link din referrer", async ({ page, baseURL }) => {
    const captured: { event: string; properties: Record<string, unknown> }[] = [];
    await page.route("**/ingest/**", async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || !new URL(request.url()).pathname.endsWith("/e/")) {
        await route.continue();
        return;
      }
      const raw = request.postDataBuffer()!;
      let json = raw.toString("utf8");
      if (raw[0] === 0x1f && raw[1] === 0x8b) json = gunzipSync(raw).toString("utf8");
      else if (json.startsWith("data=")) {
        json = Buffer.from(new URLSearchParams(json).get("data")!, "base64").toString("utf8");
      }
      const payload = JSON.parse(json);
      captured.push(...(Array.isArray(payload) ? payload : [payload]));
      // Nu trimitem evenimentele sintetice in PostHog.
      await route.fulfill({ json: { status: 1 } });
    });
    const callback = new URL("/api/auth/callback/resend", baseURL!);
    callback.searchParams.set("token", "e2e-sensitive-token");
    callback.searchParams.set("email", "e2e-sensitive-email@example.test");
    const referrer = new URL("/verify", baseURL!);
    referrer.searchParams.set("u", callback.toString());
    await page.goto("/login?error=Verification", { referer: referrer.toString() });
    await expect
      .poll(() =>
        captured.some(
          (event) =>
            event.event === "$pageview" && String(event.properties.$referrer).includes("/verify?"),
        ),
      )
      .toBe(true);
    const pageview = captured.find(
      (event) =>
        event.event === "$pageview" && String(event.properties.$referrer).includes("/verify?"),
    )!;
    expect(String(pageview.properties.$referrer)).toContain("u=%5Bredacted%5D");
    expect(String(pageview.properties.$current_url)).toContain("error=Verification");
    expect(JSON.stringify(captured)).not.toContain("e2e-sensitive-");
  });

  test("fără param u → Link invalid, fără AutoVerify", async ({ page }) => {
    await page.goto("/verify");
    await expect(page.getByText("Link invalid")).toBeVisible();
    await expect(page.getByRole("link", { name: "Înapoi la autentificare" })).toBeVisible();
  });

  test("SEC-03: u pe altă origine → respins ca link invalid (anti open-redirect)", async ({
    page,
  }) => {
    await page.goto(
      `/verify?u=${encodeURIComponent("https://evil.example.com/api/auth/callback/resend")}`,
    );
    await expect(page.getByText("Link invalid")).toBeVisible();
  });

  test("SEC-03: u pe origine proprie dar path greșit (nu /api/auth/callback/) → respins", async ({
    page,
    baseURL,
  }) => {
    const target = new URL("/feed", baseURL ?? "http://localhost:3000").toString();
    await page.goto(`/verify?u=${encodeURIComponent(target)}`);
    await expect(page.getByText("Link invalid")).toBeVisible();
  });
});

test("/maintenance randează ecranul static (public, indiferent de lockdown)", async ({ page }) => {
  await page.goto("/maintenance");
  await expect(page).toHaveURL(/\/maintenance$/);
  await expect(page.getByRole("heading", { name: "Site în lucru" })).toBeVisible();
});
