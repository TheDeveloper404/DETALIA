// „Fold" diacritice românești — substituție 1-la-1 (NU normalizare Unicode NFD: aia descompune ă/ț în
// 2 code units, ceea ce ar dezalinia indicii cu textul original — vezi highlight.ts, care mapează
// poziții găsite în textul „folded" înapoi pe textul original neschimbat).
// Acoperă ambele codări întâlnite în date reale: virgulă dedesubt (ș/ț, Unicode corect pt română) ȘI
// sedilă (ş/ţ, encoding vechi/turcesc, comun din taste/fonturi mai vechi) — utilizatorul nu știe/nu-i
// pasă care variantă a fost folosită la scriere.
const DIACRITIC_MAP: Record<string, string> = {
  ă: "a",
  â: "a",
  î: "i",
  ș: "s",
  ş: "s",
  ț: "t",
  ţ: "t",
  Ă: "A",
  Â: "A",
  Î: "I",
  Ș: "S",
  Ş: "S",
  Ț: "T",
  Ţ: "T",
};

const DIACRITIC_RE = /[ăâîșşțţĂÂÎȘŞȚŢ]/g;

export function foldDiacritics(s: string): string {
  return s.replace(DIACRITIC_RE, (c) => DIACRITIC_MAP[c] ?? c);
}
