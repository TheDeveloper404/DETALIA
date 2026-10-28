// Filtrele din meniul „Filtre" al feed-ului: ce chip-uri arata si cum se reseteaza. Pur, fara I/O.
import { COUNTIES } from "@/server/domain/detail";
import { ROLE_MAIN_LABELS } from "@/server/domain/roles";

export const FEED_FILTER_KEYS = ["following", "unanswered", "role", "judet"] as const;
export type FeedFilterKey = (typeof FEED_FILTER_KEYS)[number];

export function feedFilterChips(params: URLSearchParams): { key: FeedFilterKey; label: string }[] {
  const chips: { key: FeedFilterKey; label: string }[] = [];
  if (params.get("following") === "1") chips.push({ key: "following", label: "Doar ce urmăresc" });
  if (params.get("unanswered") === "1") chips.push({ key: "unanswered", label: "Așteaptă ajutor" });
  const role = params.get("role");
  if (role && Object.hasOwn(ROLE_MAIN_LABELS, role)) {
    chips.push({ key: "role", label: "Rol: " + ROLE_MAIN_LABELS[role as keyof typeof ROLE_MAIN_LABELS] });
  }
  const county = params.get("judet");
  if (county && (COUNTIES as readonly string[]).includes(county)) {
    chips.push({ key: "judet", label: "Județ: " + county });
  }
  return chips;
}

export function clearFeedFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of FEED_FILTER_KEYS) next.delete(key);
  next.delete("page");
  return next;
}
