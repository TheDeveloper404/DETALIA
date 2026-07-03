import path from "node:path";

import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Variabile E2E (E2E_BASE_URL al mediului-țintă, DATABASE_URL pt seed sesiune) din `.env.e2e` (negitat).
dotenv.config({ path: path.resolve(__dirname, ".env.e2e") });

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
  use: {
    baseURL,
    trace: "on-first-retry",
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
      testMatch: /public\.spec\.ts/,
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
      testMatch: [/authed\.spec\.ts/, /sketch\.spec\.ts/],
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
      testMatch: [/security\.spec\.ts/, /integration\.spec\.ts/],
      dependencies: ["setup"],
    },
  ],
});
