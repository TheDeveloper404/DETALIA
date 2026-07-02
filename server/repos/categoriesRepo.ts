// Repo categorii — singurul loc cu acces Drizzle pentru tabelul `categories` (arbore self-FK).
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, detailCategories, details } from "@/db/schema";

export async function getCategoryById(id: string) {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ?? null;
}

// Numărul de ID-uri valide dintr-o listă (verificare de integritate pentru multi-categorie la creare).
export async function countExistingCategoryIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(categories)
    .where(inArray(categories.id, ids));
  return row?.count ?? 0;
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

// Categoriile FRUNZĂ (bifabile) cu numărul de detalii PUBLISHED — pentru sidebar/rail în feed.
// Secțiunile (parentId null — headere de grupare, ex. „Clasificare după zonă") NU sunt filtre reale,
// excluse aici (rămân doar în `listCategories()`, pentru arborele din formularul de creare detaliu).
// LEFT JOIN prin `detail_categories` (many-to-many, „bifezi oricâte") + GROUP BY (forma canonică)
// → categoriile fără detalii rămân cu 0; `count(...)` distinct pe detailId, non-null. Sortat alfabetic.
export async function listCategoriesWithCounts() {
  const detailCount = sql<number>`count(distinct ${details.id})::int`;
  return db
    .select({ id: categories.id, name: categories.name, count: detailCount })
    .from(categories)
    .leftJoin(detailCategories, eq(detailCategories.categoryId, categories.id))
    .leftJoin(
      details,
      and(eq(details.id, detailCategories.detailId), eq(details.status, "PUBLISHED")),
    )
    .where(isNotNull(categories.parentId))
    .groupBy(categories.id, categories.name)
    .orderBy(asc(categories.name));
}
