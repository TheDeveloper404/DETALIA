import { expect, test } from "@playwright/test";

// E2E — /profile/edit: editarea datelor de profil + secțiunea de verificare rol (pe HOLD, doar text static).
// Rolul propriu-zis NU se editează aici (definitiv) — nu testăm schimbare de rol.

test.describe("Editare profil", () => {
  test("pagina se încarcă cu formularul precompletat", async ({ page }) => {
    await page.goto("/profile/edit");
    await expect(page).toHaveURL(/\/profile\/edit/);
    await expect(page.getByRole("heading", { name: "Detalii profil" })).toBeVisible();
    await expect(page.getByLabel("Nume afișat")).toHaveValue("E2E Tester");
  });

  test("verificarea rolului arată mesajul de HOLD (funcție indisponibilă)", async ({ page }) => {
    await page.goto("/profile/edit");
    await expect(page.getByRole("heading", { name: "Verificarea rolului" })).toBeVisible();
    await expect(page.getByText("Această funcție nu este încă disponibilă.")).toBeVisible();
  });

  test("editează headline → salvează → mesaj de succes + valoare persistă la reload", async ({ page }) => {
    await page.goto("/profile/edit");
    const headline = page.getByLabel(/Titlu\/headline/);
    const value = `E2E headline ${Date.now()}`;
    await headline.fill(value);
    await page.getByRole("button", { name: "Salvează profilul" }).click();

    // Timeout generos: sub 6 workers paraleli, round-trip-ul server action-ului poate depăși 5s
    // impliciți (buton „Se salvează…" încă disabled la eșec, nu bug de cod — bug găsit 2026-07-14).
    await expect(page.getByRole("status")).toHaveText("Profilul a fost actualizat.", { timeout: 10_000 });
    await page.reload();
    await expect(page.getByLabel(/Titlu\/headline/)).toHaveValue(value);
  });

  test("nume gol → eroare de validare, rămâne pe formular", async ({ page }) => {
    await page.goto("/profile/edit");
    await page.getByLabel("Nume afișat").fill("");
    await page.getByRole("button", { name: "Salvează profilul" }).click();

    await expect(page).toHaveURL(/\/profile\/edit/);
    // required nativ blochează submit-ul — formularul rămâne, fără eroare de server necesară aici.
    await expect(page.getByLabel("Nume afișat")).toHaveValue("");
  });
});
