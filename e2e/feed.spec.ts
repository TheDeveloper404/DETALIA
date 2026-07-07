import { expect, test } from "@playwright/test";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "../db";
import { categories } from "../db/schema";

// Sidebar de categorii pe feed — ierarhie (secțiuni + capitole cu dropdown + frunze), NU o listă
// flată (2026-07-07, cerere Liviu: „ordinea din document, cu titluri/subtitluri/dropdown"). Verificăm
// pattern-ul de bază: un capitol (ex. Instalații) pornește colapsat, se deschide la click, iar
// clic pe o frunză din el filtrează feed-ul (URL ?cat=<id>).

async function pickGroupWithChild(): Promise<{ groupId: string; groupName: string; childId: string; childName: string }> {
  const [group] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(isNotNull(categories.parentId), eq(categories.isGroup, true)))
    .limit(1);
  if (!group) throw new Error("Niciun capitol (isGroup=true) găsit — rulează `npm run db:seed`.");

  const [child] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.parentId, group.id))
    .limit(1);
  if (!child) throw new Error(`Capitolul ${group.name} nu are nicio sub-categorie.`);

  return { groupId: group.id, groupName: group.name, childId: child.id, childName: child.name };
}

test("sidebar feed: capitolul pornește colapsat, se deschide la click, frunza filtrează", async ({ page }) => {
  const { groupName, childId, childName } = await pickGroupWithChild();

  await page.goto("/feed");
  await expect(page.getByRole("navigation", { name: "Filtru categorii" })).toBeVisible();

  const groupButton = page.getByRole("button", { name: groupName, exact: true });
  await expect(groupButton).toBeVisible();
  await expect(groupButton).toHaveAttribute("aria-expanded", "false");

  // Frunza NU e vizibilă cât timp capitolul e colapsat.
  await expect(page.getByRole("link", { name: new RegExp(childName) })).toHaveCount(0);

  await groupButton.click();
  await expect(groupButton).toHaveAttribute("aria-expanded", "true");

  const childLink = page.getByRole("link", { name: new RegExp(childName) });
  await expect(childLink).toBeVisible();
  await childLink.click();

  await expect(page).toHaveURL(new RegExp(`\\?cat=${childId}$`));
});
