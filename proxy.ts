// Proxy (Next.js 16 — fostul „middleware") — DENY-BY-DEFAULT: tot ce nu e explicit
// public cere sesiune. Frontend-ul NU e sursa de adevăr; asta e doar prima poartă
// (gating de rute). Authz fină (rol, ownership) se face în services pe server, nu aici.
//
// Rulează configul Auth.js complet (edge-safe — vezi lib/auth.ts).

import { auth } from "@/lib/auth";

// Prefixe publice (accesibile fără sesiune). Restul = protejat.
const PUBLIC_PATHS = [
  "/", // landing
  "/login", // autentificare (magic link)
  "/signup", // înregistrare publică (magic link)
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // User logat pe landing → direct în feed. Făcut AICI (redirect 307 curat), nu în pagină:
  // un redirect() din pagină se produce în timpul streaming-ului → Next emite un meta-refresh,
  // care în unele browsere intră în buclă de reîncărcare. Middleware-ul evită complet asta.
  if (pathname === "/" && isLoggedIn) {
    return Response.redirect(new URL("/feed", req.nextUrl.origin));
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );

  if (isPublic || isLoggedIn) {
    return; // lasă să treacă
  }

  // Neautentificat pe rută protejată → redirect la login, cu callback de revenire.
  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return Response.redirect(loginUrl);
});

// Matcher: aplicăm peste tot, MAI PUȚIN rutele Auth.js (/api/auth/*), asset-urile
// Next și fișierele statice (evită overhead + bucle de redirect).
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
