// Instanță Postgres reală (PGlite, in-memory/WASM) pentru teste care trebuie să ruleze SQL-ul efectiv,
// nu mock-uit — vezi server/repos/detailsRepo.correlated.test.ts. Motiv: bug-ul recidivat de 3 ori
// (subquery corelat necalificat → count mereu 0, silențios, fără eroare SQL) nu poate fi prins de un
// test care mock-uiește repo-ul — trebuie rulat SQL-ul real pe date seed cunoscute.
//
// Aplică migrațiile EXISTENTE din db/migrations (aceleași folosite pe dev/production), nu un schema
// paralel — dacă migrațiile diverg de la schema.ts, testul o arată la fel ca pe Neon.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "./schema";

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle({ client, schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "./db/migrations" });
  return { db, client };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>["db"];
