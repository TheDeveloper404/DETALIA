import { highlightMatches } from "@/lib/highlight";

// Randează un text cu porțiunile potrivite unui termen de căutare evidențiate (`<mark>`) — folosit pe
// cardul de feed pentru titlu/descriere, când vii dintr-un `?q=`. Fără termen, randează textul simplu
// (fără span-uri suplimentare inutile în DOM).
export function HighlightedText({ text, query }: { text: string; query?: string | null }) {
  if (!query?.trim()) return <>{text}</>;

  return (
    <>
      {highlightMatches(text, query).map((seg, i) =>
        seg.matched ? (
          <mark key={i} className="rounded-sm bg-primary/20 text-inherit">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}
