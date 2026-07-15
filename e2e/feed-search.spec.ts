import { expect, test } from "@playwright/test";

import { getSeed } from "./seed";

// E2E — feed: căutare (?q=) și filtrare pe categorie (?cat=). Feed-ul e finit/sortat, fără scroll infinit
// (vezi CLAUDE.md „Discovery"). Distinct de feed.spec.ts, care testează doar sidebar-ul de categorii.

test("căutare cu termen din titlul detaliului seedat → apare în rezultate", async ({ page }) => {
  const { detailTitle } = getSeed();
  const term = detailTitle.split(" ")[0];

  await page.goto(`/feed?q=${encodeURIComponent(term)}`);
  await expect(page.getByRole("heading", { name: `Rezultate pentru „${term}”` })).toBeVisible();
  // Titlul apare de 2 ori pe pagină (cardul + rail-ul „Cele mai dezbătute") — doar cardul e heading real
  // (<h3>), rail-ul e un simplu <Link> → getByRole("heading") dezambiguizează.
  await expect(page.getByRole("heading", { name: detailTitle })).toBeVisible();
});

test("căutare fără rezultate → empty state de căutare", async ({ page }) => {
  const term = `garbage-nomatch-${Date.now()}`;
  await page.goto(`/feed?q=${encodeURIComponent(term)}`);

  await expect(page.getByRole("heading", { name: "Niciun Rezultat" })).toBeVisible();
  await expect(
    page.getByText("Nu am găsit niciun detaliu care să se potrivească acestei căutări."),
  ).toBeVisible();
});

test("filtrare pe categoria detaliului seedat → detaliul apare", async ({ page }) => {
  const { categoryId, detailTitle } = getSeed();
  const term = detailTitle.split(" ")[0];
  // cat + q combinate — feed-ul e finit (top ~20 după interacțiuni); doar `cat` riscă să scoată
  // detaliul seedat (puține interacțiuni) din top 20 pe un DB shared cu multe alte detalii din
  // aceeași categorie, create de restul suitei. `q` restrânge determinist la titlul exact.
  await page.goto(`/feed?cat=${categoryId}&q=${encodeURIComponent(term)}`);

  await expect(page).toHaveURL(new RegExp(`cat=${categoryId}`));
  await expect(page.getByRole("heading", { name: detailTitle })).toBeVisible();
});

test("categorie inexistentă în URL → filtru ignorat (fallback pe feed nefiltrat)", async ({ page }) => {
  await page.goto("/feed?cat=00000000-0000-0000-0000-000000000000");
  // activeId devine null când categoria nu există în listă → titlul rămâne cel implicit, nu 500/crash.
  await expect(page.getByRole("heading", { name: "Detalii în dezbatere" })).toBeVisible();
});
