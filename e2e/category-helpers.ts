import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../db";
import { categories } from "../db/schema";

// Frunze DIRECT vizibile în dropdown-ul de categorii, fără să expandezi un capitol întâi — adică
// frunze al căror părinte e o SECȚIUNE de top (parentId null), NU un capitol (ex. Instalații/Fațadă)
// care ar avea nevoie de un click suplimentar de expandare. Ierarhia reală e pe 3 niveluri (2026-07-07,
// vezi CHANGELOG „ierarhia de categorii prăbușită la 2") — nu orice frunză e direct clickabilă.
const parent = alias(categories, "parent");

export async function pickLeafCategories(limit: number): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .innerJoin(parent, eq(parent.id, categories.parentId))
    .where(and(isNotNull(categories.parentId), eq(categories.isGroup, false), isNull(parent.parentId)))
    .limit(limit);
  if (rows.length < limit) {
    throw new Error(
      `Nevoie de cel puțin ${limit} categorii-frunză direct vizibile (copii de secțiune, nu de capitol) — rulează \`npm run db:seed\`.`,
    );
  }
  return rows;
}
