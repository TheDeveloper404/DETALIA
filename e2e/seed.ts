import { readFileSync } from "node:fs";
import path from "node:path";

// Citire LAZY a `.auth/seed.json` scris de `auth.setup.ts` — folosit de toate spec-urile care au nevoie
// de id-uri seedate (detailId, testerUserId, authorUserId, categoryId), fără DB/sesiune proprie.
export type E2ESeed = {
  detailId: string;
  detailTitle: string;
  testerUserId: string;
  authorUserId: string;
  categoryId: string;
};

let seed: E2ESeed | null = null;

export function getSeed(): E2ESeed {
  if (!seed) {
    seed = JSON.parse(readFileSync(path.resolve(__dirname, ".auth", "seed.json"), "utf8")) as E2ESeed;
  }
  return seed;
}
