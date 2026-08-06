// Formatare dată pentru UI (română). Centralizat ca să nu repetăm Intl prin pagini.

// timeZone FIX (nu implicit): fără el, formatarea depinde de fusul orar al mediului de execuție —
// serverul (Vercel) rulează în UTC, browserul clientului în ora locală (România) → pentru un timestamp
// aproape de miezul nopții UTC, server și client pot afișa ZILE diferite → hydration mismatch (React #418)
// chiar la randarea inițială. Europe/Bucharest fixează rezultatul, identic pe server și pe client.
const dateMedium = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeZone: "Europe/Bucharest" });

// „18 iun. 2026" — pentru data de publicare a unui detaliu.
export function formatDate(value: Date | string | number): string {
  return dateMedium.format(new Date(value));
}

// „acum 3 ore" / „acum 2 zile" — pentru comentarii și poziții. Relativ, simplu, fără librărie.
export function formatRelative(value: Date | string | number): string {
  const then = new Date(value).getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);

  if (diffSec < 45) return "acum câteva secunde";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `acum ${diffMin} ${diffMin === 1 ? "minut" : "minute"}`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `acum ${diffHour} ${diffHour === 1 ? "oră" : "ore"}`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `acum ${diffDay} ${diffDay === 1 ? "zi" : "zile"}`;
  return formatDate(value);
}

// „Publicat acum" / „acum 5 minute" / „acum 3 zile" — pentru data de publicare din feed.
//
// Separată de `formatRelative` (comentarii/notificări) DINADINS: pragul de trecere la dată exactă e
// 7 zile aici, 30 la cealaltă, iar primul prag are text propriu („Publicat acum"). Modificarea
// funcției existente ar fi schimbat tăcut afișarea comentariilor și a notificărilor.
//
// `now` e injectabil pentru teste; în producție rămâne Date.now().
export function formatPublishedRelative(value: Date | string | number, now: number = Date.now()): string {
  const then = new Date(value).getTime();
  const diffSec = Math.round((now - then) / 1000);

  // Timestamp în viitor (ceas desincronizat client/server) — tratat ca „acum", nu „acum -3 minute".
  if (diffSec < 60) return "Publicat acum";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `acum ${diffMin} ${diffMin === 1 ? "minut" : "minute"}`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `acum ${diffHour} ${diffHour === 1 ? "oră" : "ore"}`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay <= 7) return `acum ${diffDay} ${diffDay === 1 ? "zi" : "zile"}`;
  return formatDate(value);
}
