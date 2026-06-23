// Service categorii — citire pentru UI (filtre, formular de creare detaliu).
// UI-ul citește prin service, nu atinge repo-ul/DB direct.
import {
  listCategories as listCategoriesRepo,
  listCategoriesWithCounts as listCategoriesWithCountsRepo,
} from "@/server/repos/categoriesRepo";

export async function listCategories() {
  return listCategoriesRepo();
}

// Categorii + nr. de detalii publicate (sidebar/rail în feed).
export async function listCategoriesWithCounts() {
  return listCategoriesWithCountsRepo();
}
