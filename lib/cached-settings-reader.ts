// Cache in-memory cu TTL + „ultima valoare bună" pentru citiri de config pe căi fierbinți (gate-ul de
// lockdown din proxy rulează la FIECARE request de pagină — înainte, un SELECT per afișare).
//
// Contract (gândit pentru getSettingsRow, care NU aruncă niciodată — întoarce null la eroare):
// - în TTL → valoarea din cache, zero I/O;
// - cererile concurente la cache expirat se deduplichează (o singură citire, nu N — rafala de N workeri
//   e2e producea N eșecuri simultane);
// - `null` după ce am avut cândva un rând = eroare tranzitorie (rândul singleton nu se șterge niciodată
//   în practică) → ținem ultima valoare bună încă un TTL, nu flip-uim gate-ul pe un blip de DB;
// - `null` fără nicio valoare anterioară = legitim (tabel gol / prima citire eșuată) → null.
export function createCachedSettingsReader<T>(
  fetchRow: () => Promise<T | null>,
  ttlMs: number,
): () => Promise<T | null> {
  let cache: { row: T | null; fetchedAt: number } | null = null;
  let inFlight: Promise<T | null> | null = null;

  return async function read(): Promise<T | null> {
    if (cache && Date.now() - cache.fetchedAt < ttlMs) return cache.row;

    inFlight ??= fetchRow()
      .then((row) => {
        cache = row === null && cache ? { row: cache.row, fetchedAt: Date.now() } : { row, fetchedAt: Date.now() };
        return cache.row;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
}
