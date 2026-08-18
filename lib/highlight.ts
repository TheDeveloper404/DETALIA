// Spargere text în segmente potrivite/nepotrivite pe un termen de căutare, pentru evidențiere vizuală
// (`<mark>`) în UI — pură, fără DOM, ca să fie testabilă separat de componenta care o randează
// (`DetailCard`, care primește `searchQuery` din `?q=`, la fel ca `listFeed`/ILIKE pe server).
export type HighlightSegment = { text: string; matched: boolean };

// Caractere speciale regex din termenul userului trebuie escapate literal — altfel un input ca
// „(hidro" ar arunca o eroare de regex invalidă în loc să caute literal paranteza.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Termen gol/doar spații → tot textul, ca un singur segment nepotrivit (nimic de evidențiat).
// Potrivire case-insensitive, ca la ILIKE pe server (aceeași semantică, ca userul să vadă evidențiat
// exact ce a găsit search-ul, nu doar o potrivire coincidentă case-sensitive).
export function highlightMatches(text: string, query: string): HighlightSegment[] {
  const trimmed = query.trim();
  if (!trimmed) return [{ text, matched: false }];

  const parts = text.split(new RegExp(`(${escapeRegExp(trimmed)})`, "gi"));
  return parts.filter((p) => p.length > 0).map((p) => ({ text: p, matched: p.toLowerCase() === trimmed.toLowerCase() }));
}
