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
const ALLOWED_EXACT_HOSTS = new Set(["detalia.ro"]);
const ALLOWED_HOST_PATTERN = /^detalia-[a-z0-9-]+\.vercel\.app$/;

function isAllowedHost(host: string): boolean {
  return ALLOWED_EXACT_HOSTS.has(host) || ALLOWED_HOST_PATTERN.test(host);
}

export function resolveMagicLinkBaseUrl(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host && isAllowedHost(host)) {
    const protocol = request.headers.get("x-forwarded-proto") ?? "https";
    return `${protocol}://${host}`;
  }
  return process.env.AUTH_URL ?? "http://localhost:3000";
}
