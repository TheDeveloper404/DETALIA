// Verifică dacă o rută e publică (fără sesiune), pe baza unei liste de PREFIXE. Fișier separat de
// `proxy.ts` ca să rămână testabil izolat (proxy.ts importă `next-auth/jwt` + repos DB, nu poate fi
// importat direct în teste unitare fără efecte de mediu edge).
//
// SEC: match pe prefix EXACT + segment complet — `pathname.startsWith(p + "/")` fără verificare de
// segment gol lăsa `/projects/join/` (FĂRĂ token) tratat ca public, care cădea pe ruta dinamică
// `/projects/[id]` cu `id="join"` — un `redirect()` din interiorul paginii (nu din proxy), care în
// Next.js face streaming parțial înainte de redirect (body mare, ~15KB payload RSC, găsit de ZAP
// 2026-08-22 — fără date sensibile, dar rutare greșită reală). Fix: prefixul e public DOAR dacă
// urmează un segment NEGOL după `/`.
//
// SEC-05 (audit 2026-08-22, follow-up): fix-ul de mai sus nu acoperea varianta FĂRĂ slash final —
// `/projects/join` (exact, fără token) rămânea public prin ramura `pathname === p`, cădea pe aceeași
// rută dinamică greșită. `requiresSegment` marchează explicit prefixele care NU au sens ca path exact
// (au nevoie STRICT de un segment după, ex. token/id) — pentru acestea, chiar și match-ul exact e refuzat.
export function isPublicPath(
  pathname: string,
  publicPaths: readonly string[],
  requiresSegment: readonly string[] = [],
): boolean {
  const segmentOnly = new Set(requiresSegment);
  return publicPaths.some((p) => {
    const prefix = `${p}/`;
    const prefixMatch = pathname.startsWith(prefix) && pathname.length > prefix.length;
    if (segmentOnly.has(p)) return prefixMatch;
    if (pathname === p) return true;
    if (p === "/") return false;
    return prefixMatch;
  });
}
