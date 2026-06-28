// Repo categorii — singurul loc cu acces Drizzle pentru tabelul `categories` (arbore self-FK).
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { and, asc, eq, sql } from "drizzle-orm";

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
// LEFT JOIN + GROUP BY (forma canonică) → categoriile fără detalii rămân cu 0; `count(details.id)`
// numără doar rândurile join-uite (non-null). `::int` ca să vină number, nu string. Sortat alfabetic.
export async function listCategoriesWithCounts() {
  const detailCount = sql<number>`count(${details.id})::int`;
  return db
    .select({ id: categories.id, name: categories.name, count: detailCount })
    .from(categories)
    .leftJoin(
      details,
      and(eq(details.categoryId, categories.id), eq(details.status, "PUBLISHED")),
    )
    .groupBy(categories.id, categories.name)
    .orderBy(asc(categories.name));
}
