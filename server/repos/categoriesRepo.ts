// Repo categorii — singurul loc cu acces Drizzle pentru tabelul `categories` (arbore self-FK).
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, detailCategories, details } from "@/db/schema";

export async function getCategoryById(id: string) {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ?? null;
}

// Numărul de ID-uri valide (existente ȘI bifabile — nu grupuri, ex. „Instalații") dintr-o listă —
// verificare de integritate pentru multi-categorie la creare/editare. Un grup trimis direct (ocolind
// UI-ul, care nu-l oferă ca bifabil) pică aici, nu doar la existență.
export async function countExistingCategoryIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(categories)
    .where(and(inArray(categories.id, ids), eq(categories.isGroup, false)));
  return row?.count ?? 0;
}

// Toate categoriile (UI compune arborele din parentId, până la 3 niveluri). Ordinea vine din document
// (`position`, vezi db/seed.ts) — NU alfabetic.
export async function listCategories() {
  return db
    .select({
      id: categories.id,
      parentId: categories.parentId,
      name: categories.name,
      slug: categories.slug,
      isGroup: categories.isGroup,
    })
    .from(categories)
    .orderBy(asc(categories.position));
}

// Categoriile FRUNZĂ (bifabile, `isGroup = false`) cu numărul de detalii PUBLISHED — pentru sidebar/rail
// în feed. Grupurile neselectabile (secțiunile de nivel 1 ȘI „capitolele" cu sub-categorii, ex.
// „Instalații") NU sunt filtre reale, excluse aici (rămân doar în `listCategories()`, pentru arborele
// din formularul de creare detaliu). LEFT JOIN prin `detail_categories` (many-to-many, „bifezi oricâte")
// + GROUP BY (forma canonică) → categoriile fără detalii rămân cu 0. Ordinea vine din document.
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
    .where(and(isNotNull(categories.parentId), eq(categories.isGroup, false)))
    .groupBy(categories.id, categories.name, categories.position)
    .orderBy(asc(categories.position));
}
