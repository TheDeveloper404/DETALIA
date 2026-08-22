// La user NOU (tur vizual activ), „Ce e nou" NU trebuie să apară peste tur — întârziat, ca turul să se
// termine primul. La user EXISTENT (doar login, fără tur), apare imediat ca până acum (bug găsit
// 2026-08-22: cele două se suprapuneau la orice user nou cu un anunț nevăzut). Fișier separat de
// `components/whats-new-modal.tsx` ca să rămână testabil izolat, fără efectele de import ale
// componentei client (care trage lanțul de acțiuni server → auth.ts).
export const NEW_USER_ANNOUNCEMENT_DELAY_MS = 60_000;

export function computeAnnouncementDelayMs(tourActive: boolean): number {
  return tourActive ? NEW_USER_ANNOUNCEMENT_DELAY_MS : 0;
}
