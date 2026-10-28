// Filtrele din meniul „Filtre" al feed-ului: ce chip-uri arata si cum se reseteaza. Pur, fara I/O.
import { ROLE_MAIN_LABELS } from "@/server/domain/roles";

export const FEED_FILTER_KEYS = ["following", "unanswered", "role", "verified", "sketches"] as const;
export type FeedFilterKey = (typeof FEED_FILTER_KEYS)[number];

export function feedFilterChips(params: URLSearchParams): { key: FeedFilterKey; label: string }[] {
  const chips: { key: FeedFilterKey; label: string }[] = [];
  if (params.get("following") === "1") chips.push({ key: "following", label: "Doar ce urmăresc" });
  if (params.get("unanswered") === "1") chips.push({ key: "unanswered", label: "Așteaptă ajutor" });
  const role = params.get("role");
  if (role && Object.hasOwn(ROLE_MAIN_LABELS, role)) {
    chips.push({ key: "role", label: "Rol: " + ROLE_MAIN_LABELS[role as keyof typeof ROLE_MAIN_LABELS] });
  }
  if (params.get("verified") === "1") chips.push({ key: "verified", label: "Autor verificat" });
  if (params.get("sketches") === "1") chips.push({ key: "sketches", label: "Cu schițe" });
  return chips;
}

export function clearFeedFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of FEED_FILTER_KEYS) next.delete(key);
  next.delete("page");
  return next;
}
