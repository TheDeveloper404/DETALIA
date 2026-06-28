// Proxy (Next.js 16 — fostul „middleware") — DENY-BY-DEFAULT: tot ce nu e explicit
// public cere sesiune. Frontend-ul NU e sursa de adevăr; asta e doar prima poartă
// (gating de rute). Authz fină (rol, ownership) se face în services pe server, nu aici.
//
// Rulează configul Auth.js complet (edge-safe — vezi lib/auth.ts).

import { auth } from "@/lib/auth";
import { userHasRole } from "@/server/services/roleService";

// Prefixe publice (accesibile fără sesiune). Restul = protejat.
const PUBLIC_PATHS = [
  "/", // landing
  "/login", // autentificare (magic link)
  "/signup", // înregistrare publică (magic link)
];

export default auth(async (req) => {
  const { pathname, origin } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // User logat pe landing → direct în feed. Făcut AICI (redirect 307 curat), nu în pagină:
  // un redirect() din pagină se produce în timpul streaming-ului → Next emite un meta-refresh,
  // care în unele browsere intră în buclă de reîncărcare. Middleware-ul evită complet asta.
  if (pathname === "/" && isLoggedIn) {
    return Response.redirect(new URL("/feed", origin));
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );

  // Neautentificat pe rută protejată → redirect la login, cu callback de revenire.
  if (!isPublic && !isLoggedIn) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  // POARTA DE ONBOARDING (a doua poartă, deny-by-default). Făcută AICI — nu în
  // `app/(app)/layout.tsx` — din EXACT același motiv ca redirect-ul de landing de mai sus:
  // un `redirect()` din layout în timpul streaming-ului RSC degenerează în meta-refresh →
  // buclă de loading (onboarding ⇄ feed). Proxy-ul dă un 307 curat, fără buclă.
  // Sesiune `database` + driver Neon edge-safe (vezi lib/auth.ts) → putem citi rolul aici.
  const userId = req.auth?.user?.id;
  if (isLoggedIn && userId) {
    const onOnboarding = pathname === "/onboarding";
    const hasRole = await userHasRole(userId);
    // Logat fără rol, oriunde în zona protejată → trimis să-și declare rolul întâi.
    if (!hasRole && !onOnboarding && !isPublic) {
      return Response.redirect(new URL("/onboarding", origin));
    }
    // Logat cu rol care nimerește pe onboarding → direct în feed (nu mai are ce căuta acolo).
    if (hasRole && onOnboarding) {
      return Response.redirect(new URL("/feed", origin));
    }
  }

  return; // lasă să treacă
});

// Matcher: aplicăm peste tot, MAI PUȚIN rutele Auth.js (/api/auth/*), asset-urile
// Next și fișierele statice (evită overhead + bucle de redirect).
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
