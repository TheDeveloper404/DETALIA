// Domeniul pentru linkul din emailul de magic-link vine din request-ul CURENT (host-ul
// deployment-ului care a primit cererea), NU dintr-un AUTH_URL fix — un env fix ar „ancora" toate
// preview-urile la un singur alias și ar strica redirect-urile Auth.js (signOut etc.) care
// folosesc AUTH_URL global ca bază, indiferent de deployment (regresie găsită 2026-08-22 pe E2E
// după ce AUTH_URL a fost setat pe Preview). Fișier separat de lib/auth.ts ca să rămână testabil
// izolat, fără efectele de import ale config-ului NextAuth.
//
// SEC: `x-forwarded-host`/`host` vin din request, deci sunt potențial controlate de client — fără
// allowlist, un atacator ar putea cere un magic link cu Host falsificat și primi (sau determina
// victima să primească) un email cu link-ul de login către un domeniu al lui, scurgând tokenul
// one-time din query string (`u=`). De-aia se validează contra domeniilor CUNOSCUTE ale proiectului
// înainte de folosire — host necunoscut → fallback la AUTH_URL (Production) / localhost (local).
//
// SEC-01 (audit 2026-08-22): pattern-ul inițial (`^detalia-[a-z0-9-]+\.vercel\.app$`) accepta orice
// deployment Vercel al ORICUI ale cărui proiect începe cu „detalia-” — namespace-ul `*.vercel.app` e
// global, nu al nostru; oricine își poate crea un proiect Vercel numit `detalia-auth` și primește
// exact acel domeniu. Fix: cere explicit sufixul scope-ului nostru de echipă
// (`livius-projects-1af30dca`, verificat direct din Vercel API), nu doar prefixul „detalia-”.
const ALLOWED_EXACT_HOSTS = new Set(["detalia.ro"]);
const ALLOWED_HOST_PATTERN = /^detalia-[a-z0-9-]+-livius-projects-1af30dca\.vercel\.app$/;

function isAllowedHost(host: string): boolean {
  return ALLOWED_EXACT_HOSTS.has(host) || ALLOWED_HOST_PATTERN.test(host);
}

// SEC-06 (audit 2026-08-22): sursă UNICĂ pentru „ce origine e de încredere" — folosită atât la
// construcția linkului din email (mai jos), CÂT ȘI la validarea lui în `app/verify/page.tsx`. Înainte,
// `/verify` valida separat față de `AUTH_URL`, care a fost scos din scope-ul Preview în aceeași sesiune
// (vezi CHANGELOG „J") → cele două modele de origine divergeau, ruptură silențioasă pe Preview.
export function resolveTrustedOrigin(host: string | null | undefined): string {
  // SEC-08: protocolul NU vine din `x-forwarded-proto` (tot un header de client) — hostul din
  // allowlist e mereu servit pe https; doar fallback-ul de localhost e http.
  if (host && isAllowedHost(host)) return `https://${host}`;
  return process.env.AUTH_URL ?? "http://localhost:3000";
}

export function resolveMagicLinkBaseUrl(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return resolveTrustedOrigin(host);
}
