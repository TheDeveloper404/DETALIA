// Service categorii — citire pentru UI (filtre, formular de creare detaliu).
// UI-ul citește prin service, nu atinge repo-ul/DB direct.
import { listCategories as listCategoriesRepo } from "@/server/repos/categoriesRepo";

export async function listCategories() {
  return listCategoriesRepo();
}
