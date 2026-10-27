import { expect, test } from "@playwright/test";

// Suport în aplicație (2026-10-27): „Ajutor" din meniul userului → formular → Slack (#detalia-support-test
// pe preview, prin SLACK_SUPPORT_WEBHOOK_URL). Pagina de profil, nu feed-ul, ca să nu pornească turul ghidat.

test.describe("Suport — formular din meniu", () => {
  test("Ajutor din meniu trimite cererea și arată confirmarea", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("button", { name: "Meniul tău" }).click();
    await page.getByRole("menuitem", { name: "Ajutor" }).click();

    const dialog = page.getByRole("dialog", { name: "Ai nevoie de ajutor?" });
    await expect(dialog).toBeVisible();

    const send = dialog.getByRole("button", { name: "Trimite" });
    await dialog.getByLabel("Ce nu merge?").fill("scurt");
    await expect(send).toBeDisabled();

    await dialog.getByLabel("Ce nu merge?").fill("Test E2E: verific formularul de suport din meniu.");
    await send.click();

    await expect(dialog.getByRole("heading", { name: "Am primit mesajul" })).toBeVisible();
    await dialog.getByRole("button", { name: "Închide" }).click();
    await expect(dialog).toBeHidden();
  });
});
