import { getSeenDetailTour, markDetailTourSeen as markDetailTourSeenRepo } from "@/server/repos/usersRepo";

// Turul ghidat de pe pagina de detaliu (components/detail-product-tour.tsx) — spre deosebire de turul
// din feed (declanșat o singură dată din onboarding, via `?tour=1`), pagina de detaliu se deschide din
// zeci de locuri diferite → nu există un moment unic de agățat un query param, deci flag persistat.
export function hasSeenDetailTour(userId: string): Promise<boolean> {
  return getSeenDetailTour(userId);
}

// userId din sesiune (anti-IDOR) — apelat DOAR de acțiunea proprie a userului (confirmDetailTourSeenAction).
export function markDetailTourSeen(userId: string): Promise<void> {
  return markDetailTourSeenRepo(userId);
}
