import { expect, test } from "@playwright/test";
import { and, eq, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../db";
import { categories } from "../db/schema";
import { getSeed } from "./seed";

// Sidebar de categorii pe feed — ierarhie (secțiuni + capitole cu dropdown + frunze), NU o listă
// flată (2026-07-07: „ordinea din document, cu titluri/subtitluri/dropdown"). Verificăm
// pattern-ul de bază: un capitol (ex. Instalații) pornește colapsat, se deschide la click, iar
// clic pe o frunză din el filtrează feed-ul (URL ?cat=<id>).

async function pickGroupWithChild(): Promise<{
  sectionName: string;
  otherSectionName: string;
  groupName: string;
  childId: string;
  childName: string;
}> {
  const section = alias(categories, "section");
  const [group] = await db
    .select({ id: categories.id, name: categories.name, sectionId: section.id, sectionName: section.name })
    .from(categories)
    .innerJoin(section, and(eq(section.id, categories.parentId), isNull(section.parentId)))
    .where(eq(categories.isGroup, true))
    .limit(1);
  if (!group) throw new Error("Niciun capitol (isGroup=true) într-o secțiune — rulează `npm run db:seed`.");

  const [child] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.parentId, group.id))
    .limit(1);
  if (!child) throw new Error(`Capitolul ${group.name} nu are nicio sub-categorie.`);

  const [other] = await db
    .select({ name: categories.name })
    .from(categories)
    .where(and(isNull(categories.parentId), eq(categories.isGroup, true), ne(categories.id, group.sectionId)))
    .limit(1);
  if (!other) throw new Error("E nevoie de cel puțin două secțiuni de categorii.");

  return {
    sectionName: group.sectionName,
    otherSectionName: other.name,
    groupName: group.name,
    childId: child.id,
    childName: child.name,
  };
}

// Varianta B aprobata pentru coloana Categorii de pe desktop: „2×2, inchise, una” — sectiunile pornesc
// inchise si se deschide una singura odata.
test("sidebar feed: sectiunile pornesc inchise, una singura deschisa, capitolul se deschide la click, frunza filtrează", async ({ page }) => {
  const { sectionName, otherSectionName, groupName, childId, childName } = await pickGroupWithChild();

  await page.goto("/feed");
  // Scopat STRICT la sidebar-ul de categorii — pe toată pagina, alte teste rulate în paralel pot
  // publica concurent detalii cu aceeași categorie (card + tag în feed-ul principal), dând fals-pozitiv
  // pe un query global (`page.getByRole(...)` fără scop).
  const sidebar = page.getByRole("navigation", { name: "Filtru categorii" });
  await expect(sidebar).toBeVisible();

  const sectionButton = sidebar.getByRole("button", { name: sectionName, exact: true });
  const otherSectionButton = sidebar.getByRole("button", { name: otherSectionName, exact: true });
  await expect(sectionButton).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar.getByRole("button", { name: groupName, exact: true })).toHaveCount(0);
  await otherSectionButton.click();
  await expect(otherSectionButton).toHaveAttribute("aria-expanded", "true");
  await sectionButton.click();
  await expect(sectionButton).toHaveAttribute("aria-expanded", "true");
  await expect(otherSectionButton).toHaveAttribute("aria-expanded", "false");

  const groupButton = sidebar.getByRole("button", { name: groupName, exact: true });
  await expect(groupButton).toBeVisible();
  await expect(groupButton).toHaveAttribute("aria-expanded", "false");

  // NU exact:true — link-ul concatenează numele cu counter-ul de detalii ("Șarpantă 1"), nu e text exact.
  // Frunza NU e vizibilă cât timp capitolul e colapsat.
  await expect(sidebar.getByRole("link", { name: childName })).toHaveCount(0);

  await groupButton.click();
  await expect(groupButton).toHaveAttribute("aria-expanded", "true");

  const childLink = sidebar.getByRole("link", { name: childName });
  await expect(childLink).toBeVisible();
  await childLink.click();

  await expect(page).toHaveURL(new RegExp(`\\?cat=${childId}$`));
});

// „Schițează peste" și „Trimite în Planșă" scoase din card-ul de feed (2026-08-07, decizie produs) —
// rămân funcționale pe pagina de detaliu, nu se elimină din platformă.
test("card din feed nu mai are CTA-urile de schițare/planșă, dar pagina de detaliu le păstrează", async ({
  page,
}) => {
  const { detailId, detailTitle } = getSeed();

  await page.goto("/feed");
  const card = page.locator("article", { has: page.getByRole("heading", { name: detailTitle }) });
  await expect(card).toBeVisible();
  await expect(card.getByTitle("Schițează peste")).toHaveCount(0);
  await expect(card.getByTitle("Trimite în Planșă")).toHaveCount(0);

  await page.goto(`/details/${detailId}`);
  await expect(page.getByRole("button", { name: "Schițează" })).toBeVisible();
});
