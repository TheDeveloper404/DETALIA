import { expect, test } from "@playwright/test";

// E2E — fluxuri PUBLICE (fără autentificare). Acoperă suprafața vizibilă oricui + poarta deny-by-default.
// Nu trimit formularul cu un email valid/necunoscut (ar declanșa email real + rate limit) — doar verific
// că UI-ul e prezent și interactiv. Excepție: describe-ul "Anti-enumerare" de mai jos CHIAR trimite
// formularul, dar doar pe cazurile în care serverul garantează că NU trimite email (cont inexistent pe
// /login, cont deja existent pe /signup — vezi signInWithEmailAction) — safe de rulat repetat.
// Fluxurile authed (publicare detaliu, validare, schiță) = increment separat, cu sesiune seedată.

test.describe("Landing", () => {
  test("footer mobil: slogan sub logo, pe o singură linie la 320/390px", async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      const footer = page.locator("footer");
      const logo = footer.getByAltText("DETALIA", { exact: true });
      const slogan = footer.getByText("Detalii de execuție. Perspective asumate.", { exact: true });
      await expect(logo).toBeVisible();
      await expect(slogan).toBeVisible();
      const logoBox = await logo.boundingBox();
      const sloganBox = await slogan.boundingBox();
      expect(logoBox).not.toBeNull();
      expect(sloganBox).not.toBeNull();
      expect(sloganBox!.y).toBeGreaterThanOrEqual(logoBox!.y + logoBox!.height);
      expect(
        await slogan.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getClientRects().length;
        }),
      ).toBe(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  });

  test("se încarcă și are CTA către signup și login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/DETALIA/i);
    await expect(
      page.getByRole("heading", { level: 1, name: "Detaliile bune se construiesc împreună." }),
    ).toBeVisible();
    // CTA-uri din header (linkuri stabile, nu stiluri).
    await expect(
      page.getByRole("link", { name: "Creează cont gratuit", exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Autentifică-te", exact: true })).toBeVisible();
    await expect(page.locator("header img")).toHaveAttribute("src", "/logo.svg");
    await expect(page.locator(".dt-intro")).toHaveCount(0);
  });

  test("click pe Creează cont duce la /signup", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Creează cont gratuit", exact: true }).first().click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("header simplificat și exemplu explorabil în trei etape", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Vezi un exemplu", exact: true }).click();
    await expect(page).toHaveURL(/#cum-functioneaza$/);
    // logo · Ghid · Autentificare · CTA · LinkedIn · GitHub (Ghid + rețele ascunse sub 1000 px).
    await expect(page.locator("header").getByRole("link")).toHaveCount(6);
    await expect(
      page.locator("header").getByRole("link", { name: "Ghid", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("header").getByRole("link", { name: "DETALIA pe LinkedIn" }),
    ).toHaveAttribute("href", "https://www.linkedin.com/company/144903896/");
    await expect(
      page.locator("header").getByRole("link", { name: "Proiecte & Planșe" }),
    ).toHaveCount(0);
    const stages = page.getByRole("tablist", { name: "Etapele unui detaliu" });
    await expect(stages.getByRole("tab", { name: /01 — Detaliul/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await stages.getByRole("tab", { name: /02 — Schița/ }).click();
    await expect(
      page.getByRole("heading", { name: "O intervenție se vede. Nu trebuie ghicită." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Vezi originalul", exact: true }).click();
    await expect(page.getByRole("button", { name: "Vezi schița", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Vezi schița", exact: true }).click();
    await page.getByRole("button", { name: "Vezi argumentele", exact: true }).click();
    await expect(stages.getByRole("tab", { name: /03 — Argumentele/ })).toBeFocused();
    await expect(stages.getByRole("tab", { name: /03 — Argumentele/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("Dezaprob schița", { exact: true })).toBeVisible();
  });

  test("spațiile și perspectivele se schimbă și prin tastatură", async ({ page }) => {
    await page.goto("/");
    const spaces = page.getByRole("tablist", { name: "Alege spațiul de lucru" });
    await spaces.getByRole("tab", { name: /Planșe/ }).click();
    await expect(
      page.getByText("Planșă privată · doar pentru tine", { exact: true }),
    ).toBeVisible();
    await spaces.getByRole("tab", { name: /Planșe/ }).press("Home");
    await expect(spaces.getByRole("tab", { name: /Proiecte/ })).toBeFocused();
    const roles = page.getByRole("tablist", { name: "Perspective profesionale" });
    await roles.getByRole("tab", { name: /Proiectant/ }).focus();
    await roles.getByRole("tab", { name: /Proiectant/ }).press("End");
    await expect(roles.getByRole("tab", { name: /Beneficiar/ })).toBeFocused();
    await expect(
      page.getByRole("heading", { name: "Ce implică alegerea pentru întreținere și utilizare?" }),
    ).toBeVisible();
  });

  test("la 390px login/signup rămân accesibile, inclusiv cu reduced motion", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    // Pe mobil header-ul = logo + meniu; butoanele de cont sunt în panoul meniului.
    await page.locator("header summary[aria-label='Meniu']").click();
    await expect(
      page.locator("header").getByRole("link", { name: "Autentificare", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("header").getByRole("link", { name: "Creează cont gratuit", exact: true }),
    ).toBeVisible();
    await page.locator("header summary[aria-label='Meniu']").click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole("tab", { name: /02 — Schița/ }).click();
    await expect(page.getByRole("button", { name: "Vezi originalul", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: /Planșe/ }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});

test.describe("Autentificare (UI passwordless)", () => {
  for (const path of ["/login", "/signup"]) {
    test(`${path}: formular direct, fără desen sau controale de animație`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto(path);
      await expect(page.getByRole("img", { name: /Desen schematic animat/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Pauză animație|Reia animația/ })).toHaveCount(
        0,
      );
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByLabel("Email")).toBeEmpty();
    });
  }

  test("formular fără desen, accesibil cu reduced motion la 768/390px", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/signup");
      await expect(page.getByRole("img", { name: /Desen schematic animat/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Pauză animație" })).toHaveCount(0);
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Creează cont gratuit", exact: true }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Sari la formular", exact: true }).focus();
      await page.getByRole("link", { name: "Sari la formular", exact: true }).press("Enter");
      await expect(page.locator("#formular")).toBeFocused();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  });

  test("/login randează formularul de magic link", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Bine ai revenit." })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Trimite link-ul de acces" })).toBeVisible();
  });

  test("/signup randează formularul de creare cont", async ({ page }) => {
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { level: 1, name: "Adu perspectiva ta în detaliu." }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Creează cont gratuit", exact: true }),
    ).toBeVisible();
  });

  test("login ⇄ signup sunt legate reciproc", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Creează unul" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await page.getByRole("link", { name: /Autentific/ }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("/verify-request e public și brandat (română)", async ({ page }) => {
    await page.goto("/verify-request");
    await expect(page.getByText("Verifică-ți email-ul", { exact: true })).toBeVisible();
  });

  test("/verify-request: desenul se poate opri și relua din tastatură", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/verify-request");
    const drawing = page.getByRole("img", { name: /Desen schematic animat/ });
    await expect(drawing).toBeVisible();
    const line = drawing.locator('path[pathLength="1"]').first();
    await expect(line).toHaveCSS("animation-play-state", "running");

    const pause = page.getByRole("button", { name: "Pauză animație", exact: true });
    await pause.focus();
    await pause.press("Enter");
    const resume = page.getByRole("button", { name: "Reia animația", exact: true });
    await expect(resume).toBeFocused();
    await expect(page.locator('[data-paused="true"]')).toHaveCount(1);
    await expect(line).toHaveCSS("animation-play-state", "paused");

    await resume.press("Space");
    await expect(pause).toBeFocused();
    await expect(page.locator('[data-paused="false"]')).toHaveCount(1);
    await expect(line).toHaveCSS("animation-play-state", "running");
    await expect(page).toHaveURL(/\/verify-request$/);
  });

  test("/verify-request: desen static cu reduced motion la 768/390px", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/verify-request");
      const drawing = page.getByRole("img", { name: /Desen schematic animat/ });
      await expect(drawing).toBeVisible();
      await expect(page.getByRole("button", { name: "Pauză animație", exact: true })).toBeHidden();
      await expect(page.getByText("Desen fără animație", { exact: true })).toBeVisible();
      const line = drawing.locator('path[pathLength="1"]').first();
      await expect(line).toHaveCSS("animation-name", "none");
      await expect(line).toHaveCSS("stroke-dashoffset", "0px");
      await expect(line).toHaveCSS("opacity", "1");
      await expect(
        page.getByRole("heading", { name: "Verifică-ți email-ul", exact: true }),
      ).toBeVisible();

      const skip = page.getByRole("link", { name: "Sari la formular", exact: true });
      await skip.focus();
      await skip.press("Enter");
      await expect(page.locator("#formular")).toBeFocused();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  });
});

// BUG 2026-07-30: /login cu email fără cont arăta explicit "Nu există niciun cont..." iar /signup cu
// email deja existent arăta "Există deja un cont..." — enumerare de conturi după email. Fix: în ambele
// cazuri, niciun email trimis, dar redirect la /verify-request — identic cu răspunsul de succes real.
test.describe("Anti-enumerare (login/signup)", () => {
  test("/login cu email fără cont → /verify-request, nu un mesaj de eroare distinct", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(`e2e-no-account-${Date.now()}@detalia.test`);
    await page.getByRole("button", { name: "Trimite link-ul de acces" }).click();

    await expect(page).toHaveURL(/\/verify-request$/);
    await expect(page.getByText("Verifică-ți email-ul", { exact: true })).toBeVisible();
  });

  test("/signup cu email cu cont existent → /verify-request, nu un mesaj de eroare distinct", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByLabel("Email").fill("e2e-tester@detalia.test");
    await page.getByRole("button", { name: "Creează cont gratuit", exact: true }).click();

    await expect(page).toHaveURL(/\/verify-request$/);
    await expect(page.getByText("Verifică-ți email-ul", { exact: true })).toBeVisible();
  });
});

test.describe("Poarta deny-by-default", () => {
  test("ruta protejată ca anonim → redirect la /login cu callbackUrl", async ({ page }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });

  test("o altă rută protejată (profil) ca anonim → /login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("rută inexistentă (sub prefix public) → 404", async ({ page }) => {
    // O rută inexistentă NEPUBLICĂ ar fi prinsă de poarta deny-by-default (→ redirect /login), nu 404.
    // Sub un prefix public (`/signup/...`) trece de poartă și ajunge la 404-ul real al Next.
    const res = await page.goto("/signup/ruta-care-nu-exista-123");
    expect(res?.status()).toBe(404);
  });
});
