// Repo categorii — singurul loc cu acces Drizzle pentru tabelul `categories` (arbore self-FK).
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { categories } from "@/db/schema";

export async function getCategoryById(id: string) {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ?? null;
}

// Toate categoriile (UI compune arborele din parentId). Sortate alfabetic pentru afișare stabilă.
export async function listCategories() {
  return db
    .select({
      id: categories.id,
      parentId: categories.parentId,
      name: categories.name,
      slug: categories.slug,
    })
    .from(categories)
    .orderBy(asc(categories.name));
}
