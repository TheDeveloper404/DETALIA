// Originea publică a site-ului (Production = `AUTH_URL`), fără slash final — sursă UNICĂ pentru linkurile
// absolute construite fără request (emailuri, cron, metadata, sitemap). Un `AUTH_URL` gol sau invalid (ex. fără
// schemă) cade pe fallback în loc să producă un URL invalid — altfel `metadataBase` din app/layout.tsx ar
// arunca la încărcare și ar pica tot site-ul. Fallback-ul rămâne DOAR localhost (dev/teste) — intenționat,
// vezi SEC-004 din app/admin-page/login/actions.ts.
const FALLBACK = "http://localhost:3000";

export function siteUrl(): string {
  const url = process.env.AUTH_URL;
  return url && URL.canParse(url) ? url.replace(/\/+$/, "") : FALLBACK;
}
