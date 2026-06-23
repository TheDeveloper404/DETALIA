// Repo categorii — singurul loc cu acces Drizzle pentru tabelul `categories` (arbore self-FK).
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, details } from "@/db/schema";

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

// Categoriile cu numărul de detalii PUBLISHED — pentru sidebar/rail în feed.
// Subquery corelat (`::int` ca să vină number, nu string), sortat alfabetic.
export async function listCategoriesWithCounts() {
  const detailCount = sql<number>`(select count(*)::int from ${details}
     where ${details.categoryId} = ${categories.id} and ${details.status} = 'PUBLISHED')`;
  return db
    .select({ id: categories.id, name: categories.name, count: detailCount })
    .from(categories)
    .orderBy(asc(categories.name));
}
