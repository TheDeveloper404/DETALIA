import { expect, test } from "@playwright/test";

import { getSeed } from "./seed";

// E2E — /profile/[userId]: profilul PUBLIC (read-only) al altui user, distinct de /profile (propriul).

test("profil public al altui user → randează read-only, fără buton de editare", async ({ page }) => {
  const { authorUserId } = getSeed();
  await page.goto(`/profile/${authorUserId}`);

  await expect(page).toHaveURL(new RegExp(`/profile/${authorUserId}`));
  await expect(page.getByRole("heading", { name: "E2E Author" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Editează profil" })).not.toBeVisible();
});

test("propriul userId în URL → redirect la /profile (propriul, cu editare)", async ({ page }) => {
  const { testerUserId } = getSeed();
  await page.goto(`/profile/${testerUserId}`);

  await expect(page).toHaveURL(/\/profile$/);
});

test("userId inexistent → 404", async ({ page }) => {
  await page.goto("/profile/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText("404")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nu găsim pagina" })).toBeVisible();
});
