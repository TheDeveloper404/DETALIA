// Spargere text în segmente potrivite/nepotrivite pe un termen de căutare, pentru evidențiere vizuală
// (`<mark>`) în UI — pură, fără DOM, ca să fie testabilă separat de componenta care o randează
// (`DetailCard`, care primește `searchQuery` din `?q=`, la fel ca `listFeed`/ILIKE pe server).
import { foldDiacritics } from "./diacritics";

export type HighlightSegment = { text: string; matched: boolean };

// Caractere speciale regex din termenul userului trebuie escapate literal — altfel un input ca
// „(hidro" ar arunca o eroare de regex invalidă în loc să caute literal paranteza.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Termen gol/doar spații → tot textul, ca un singur segment nepotrivit (nimic de evidențiat).
// Potrivirea se face pe versiunile FOLDED (case + diacritice insensibile, ca la ILIKE pe server —
// aceeași semantică, ca userul să vadă evidențiat exact ce a găsit search-ul), dar segmentele randate
// păstrează textul ORIGINAL — `foldDiacritics` e o substituție 1-la-1 (nu schimbă lungimea), deci
// pozițiile găsite în textul folded sunt valide direct pe textul original.
export function highlightMatches(text: string, query: string): HighlightSegment[] {
  const trimmed = query.trim();
  if (!trimmed) return [{ text, matched: false }];

  const foldedText = foldDiacritics(text).toLowerCase();
  const foldedQuery = foldDiacritics(trimmed).toLowerCase();
  const re = new RegExp(escapeRegExp(foldedQuery), "g");

  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(foldedText))) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), matched: false });
    segments.push({ text: text.slice(match.index, match.index + match[0].length), matched: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), matched: false });

  return segments;
}
