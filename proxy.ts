// Proxy (Next.js 16 — fostul „middleware") — DENY-BY-DEFAULT: tot ce nu e explicit
// public cere sesiune. Frontend-ul NU e sursa de adevăr; asta e doar prima poartă
// (gating de rute). Authz fină (rol, ownership) se face în services pe server, nu aici.
//
// Rulează configul Auth.js complet (edge-safe — vezi lib/auth.ts).

import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { buildCspHeader } from "@/lib/csp";
import { userHasRole } from "@/server/services/roleService";

// Prefixe publice (accesibile fără sesiune). Restul = protejat.
const PUBLIC_PATHS = [
  "/", // landing
  "/login", // autentificare (magic link)
  "/signup", // înregistrare publică (magic link)
  "/verify-request", // „verifică-ți email-ul" după cererea magic link-ului (pre-auth)
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

  // SEC-04: cont suspendat (status ≠ ACTIVE). Strategie `database` → status proaspăt din DB la fiecare
  // request. Blocăm tot ce nu e public (inclusiv server actions, care lovesc rutele protejate prin POST).
  if (isLoggedIn && !isPublic && req.auth?.user?.status && req.auth.user.status !== "ACTIVE") {
    // SEC-14: cont non-ACTIVE a încercat o rută protejată → audit (userId = uuid intern, fără PII brut).
    audit(
      "access_denied_suspended",
      { userId: req.auth.user.id, status: req.auth.user.status, path: pathname },
      "warning",
    );
    return Response.redirect(new URL("/login?error=AccessDenied", origin));
  }

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
    // Excepție la poarta de rol: uploadul de imagine (avatar/cover) se face CHIAR în onboarding,
    // înainte de a avea rol. Ruta `/api/blob/upload` cere oricum sesiune (deny-by-default în handler),
    // deci e sigur s-o lăsăm să treacă fără rol — altfel poza din onboarding e redirectată (302) și eșuează.
    const onboardingAllowedApi = pathname === "/api/blob/upload";
    // Logat fără rol, oriunde în zona protejată → trimis să-și declare rolul întâi.
    if (!hasRole && !onOnboarding && !isPublic && !onboardingAllowedApi) {
      return Response.redirect(new URL("/onboarding", origin));
    }
    // Logat cu rol care nimerește pe onboarding → direct în feed (nu mai are ce căuta acolo).
    if (hasRole && onOnboarding) {
      return Response.redirect(new URL("/feed", origin));
    }
  }

  // SEC-08 hardening: CSP cu nonce per request. Generăm nonce, îl punem pe x-nonce (citit de RSC/layout pt
  // scripturile inline) ȘI pe headerul CSP (request + response) → Next aplică nonce-ul pe scripturile lui.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCspHeader(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
});

// Matcher: aplicăm peste tot, MAI PUȚIN rutele Auth.js (/api/auth/*), asset-urile Next și fișierele
// statice. SEC-13: excludem extensii statice EXPLICITE (la finalul căii), NU orice cale care conține un
// punct (`.*\..*`) — altfel o rută viitoare cu punct în segment ar scăpa tăcut de poarta de auth.
// Regula de aur: orice rută nouă e protejată by default (deny-by-default via PUBLIC_PATHS) — adaug-o în
// PUBLIC_PATHS DOAR dacă trebuie să fie publică; NU adăuga extensii noi aici fără motiv de asset static.
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff|woff2|ttf|otf)$).*)",
  ],
};
