import path from "node:path";

import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Variabile E2E (E2E_BASE_URL al mediului-țintă, DATABASE_URL pt seed sesiune) din `.env.e2e` (negitat).
dotenv.config({ path: path.resolve(__dirname, ".env.e2e"), quiet: true });

// E2E rulează pe un mediu DEJA pornit (preview Vercel sau dev local) — fără `webServer`. Mediul-țintă
// se dă prin `E2E_BASE_URL` (ex. URL-ul de preview al PR-ului). Vezi `e2e/README.md` pentru rulare.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  // Timeout GLOBAL pt. `expect()`, nu implicitul de 5s — suita rulează contra unui deploy Vercel
  // preview REAL, nu localhost, iar rularea locală (6 workers auto-detectați) lovește simultan
  // ACEEAȘI ramură + ACELAȘI user seedat. Round-trip-urile de server-mutation ocazional depășesc 5s
  // sub concurență, nu pt. că e cod stricat — orice test cu un round-trip e vulnerabil, aleatoriu,
  // sub load. Fix la sursă (2026-07-14) — nu mai peticim per-assertion pe măsură ce pică alt test.
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Preview-urile Vercel sunt în spatele Deployment Protection (zid de login SSO). Trecem de el cu
    // „Protection Bypass for Automation": un header cu secretul proiectului (+ cookie pe navigările următoare).
    // Secretul: Vercel → Settings → Deployment Protection → Protection Bypass for Automation → în `.env.e2e`.
    ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          extraHTTPHeaders: {
            "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
            "x-vercel-set-bypass-cookie": "true",
          },
        }
      : {}),
  },
  projects: [
    // Fluxuri PUBLICE — anonim (fără storageState), nicio dependență de DB.
    {
      name: "public",
      testMatch: [/(^|[\\/])public\.spec\.ts$/, /verify-and-maintenance\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    // Teaser public de schiță (/s/[id]) — anonim, fără storageState, dar are nevoie de seed.json
    // (detailId/testerUserId) și de DB pentru schița PUBLISHED de test → depinde de "setup".
    {
      name: "sketch-public",
      testMatch: /sketch-public\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    // Setup AUTHED — seedează user+rol+sesiune+detaliu în DB și salvează storageState. Cere DATABASE_URL.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Fluxuri AUTHED — pornesc cu sesiunea seedată (storageState din setup).
    {
      name: "authed",
      testMatch: [
        /authed\.spec\.ts/,
        /sketch\.spec\.ts/,
        /detail-upload\.spec\.ts/,
        /sketch-draft\.spec\.ts/,
        /canvas\.spec\.ts/,
        /detail-draft\.spec\.ts/,
        /detail-edit\.spec\.ts/,
        /feed\.spec\.ts/,
        /sketch-numbering\.spec\.ts/,
        /feed-search\.spec\.ts/,
        /profile-edit\.spec\.ts/,
        /profile-public\.spec\.ts/,
        /saved\.spec\.ts/,
        /notifications-page\.spec\.ts/,
      ],
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/state.json",
      },
    },
    // Securitate (IDOR) + integrare (service→repo, atomicitate, cascadă, polimorfism) — apeluri directe
    // service+DB (fără browser), dependință DOAR de seed.json (id-uri de user), nu de storageState/sesiune.
    {
      name: "security",
      testMatch: [
        /security\.spec\.ts/,
        /integration\.spec\.ts/,
        /admin-auth\.spec\.ts/,
        /notifications\.spec\.ts/,
      ],
      dependencies: ["setup"],
    },
    // SEC-04 la nivel de acțiune — user SUSPENDAT dedicat, cookie JWT propriu (NU storageState-ul comun
    // din "authed", ca să nu-l invalideze pentru authed.spec.ts/sketch.spec.ts care rulează în paralel).
    {
      name: "suspended",
      testMatch: /suspended\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    // Acces admin (/admin-page/*) — sesiune SEPARATĂ de useri, browser anonim (fără storageState).
    // Nu depinde de "setup" — nu folosește seed.json, doar DB direct (adminLoginTokens/adminSessions).
    {
      name: "admin-access",
      testMatch: [/admin-access\.spec\.ts/, /admin-suspend\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    // Onboarding — user dedicat FĂRĂ rol, cookie JWT propriu (storageState-ul comun din "authed" e al unui
    // user CU rol deja declarat, nu poate testa fluxul de onboarding).
    {
      name: "onboarding",
      testMatch: /onboarding\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
