import { expect, test } from "@playwright/test";

// Smoke check PRODUCȚIE — verifică integrări third-party (PostHog) chiar pe `detalia.ro`,
// nu pe preview. Motivat de incidentul 2026-07-15: migrarea PostHog a trecut build+unit+e2e (toate pe
// preview/cod) dar a rămas SILENT BROKEN în producție ~ore (env vars lipsă din Vercel + `/ingest`
// blocat de auth middleware) — nimic din suita normală de teste nu verifică integrarea LIVE, pe
// domeniul real. Acest fișier umple exact golul ăla: rulează DOAR manual (nu în CI, nu la fiecare
// deploy) — vezi `npm run smoke:prod` — și DOAR contra `https://detalia.ro`, niciodată preview/local.
//
// Read-only: nu mută date, nu creează conturi, nu declanșează email-uri.

test.use({ baseURL: "https://detalia.ro" });

test.describe("Smoke producție — PostHog", () => {
  test("remote config se încarcă prin proxy /ingest", async ({ page }) => {
    const configResponse = page.waitForResponse(
      (res) => res.url().includes("/ingest/array/") && res.url().includes("/config.js"),
    );
    await page.goto("/");
    const res = await configResponse;
    expect(res.status()).toBe(200);
  });

  test("endpoint-ul de captare evenimente răspunde prin proxy (nu redirect la /login)", async ({ request }) => {
    const res = await request.post("/ingest/i/v0/e/", {
      headers: { "Content-Type": "text/plain" },
      data: JSON.stringify({
        // token public, safe de embedat (vezi .env.example) — evenimentul e marcat explicit sintetic.
        api_key: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
        event: "smoke_check",
        properties: { distinct_id: "smoke-test-ci", source: "smoke-prod.spec.ts" },
      }),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Dacă middleware-ul de auth blochează /ingest din nou, răspunsul e HTML (pagina de login), nu JSON.
    expect(body.status).toBeDefined();
  });
});

test.describe("Smoke producție — flux public de bază", () => {
  test("landing se încarcă fără erori de consolă", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // CSP invalid-source / alte erori de consolă reale — nu doar warning-uri de la Cloudflare Turnstile.
    const relevant = errors.filter((e) => !/turnstile|cloudflare/i.test(e));
    expect(relevant).toEqual([]);
  });

  test("/login randează formularul", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});
