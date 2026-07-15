// Proxy (Next.js 16 — fostul „middleware") — DENY-BY-DEFAULT: tot ce nu e explicit
// public cere sesiune. Frontend-ul NU e sursa de adevăr; asta e doar prima poartă
// (gating de rute). Authz fină (rol, ownership) se face în services pe server, nu aici.
//
// Rulează configul Auth.js complet (edge-safe — vezi lib/auth.ts).

import { NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin-allowlist";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { buildCspHeader } from "@/lib/csp";
import { getValidAdminSessionEmail } from "@/server/repos/adminsRepo";
import { getSettingsRow } from "@/server/repos/settingsRepo";
import { userExistsById } from "@/server/repos/usersRepo";
import { userHasRole } from "@/server/services/roleService";

// Rutele de cron invocate de Vercel (fără sesiune de user) — autorizare reală prin CRON_SECRET, în
// handler. EXACTE (nu un prefix larg gen "/api/cron"), ca o rută cron nouă să NU devină public/scutită de
// lockdown implicit doar pentru că împarte prefixul — adaugi aici explicit, o dată cu handler-ul nou.
const CRON_PATHS = ["/api/cron/cleanup-notifications"];

// Prefixe publice (accesibile fără sesiune). Restul = protejat.
const PUBLIC_PATHS = [
  "/", // landing
  "/login", // autentificare (magic link)
  "/signup", // înregistrare publică (magic link)
  "/verify-request", // „verifică-ți email-ul" după cererea magic link-ului (pre-auth)
  "/verify", // auto-confirmare magic link (JS redirect → callback); inertă la GET automat de scanner (pre-auth)
  "/maintenance", // ecranul „site în lucru" (ținta rewrite-ului de lockdown) — public by design
  "/s", // teaser PUBLIC read-only al unei schițe (decizie 2026-07-05) — vezi app/s/[id]/page.tsx
  "/termeni", // Termeni și condiții — public, linkuit din footer
  "/confidentialitate", // Notă de confidențialitate (GDPR) — public, linkuit din footer
  "/sentry-tunnel", // proxy Sentry (evită ad-blockere) — trebuie accesibil și pt erori pre-auth (/login etc.)
  "/ingest", // proxy PostHog (evită ad-blockere) — trebuie accesibil pre-auth (pageview pe landing/login/signup)
  "/.well-known/security.txt", // canal RFC 9116 de raportare responsabilă — public prin natura lui
  // Panoul de admin are AUTENTIFICARE PROPRIE (lib/admin-auth.ts), separată de Auth.js. Îl scutim de
  // poarta de user (altfel ar fi redirectat la /login-ul userilor). Gating-ul real e în paginile /admin-page.
  "/admin-page",
  ...CRON_PATHS,
];

const isCronPath = (pathname: string) => CRON_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export default auth(async (req) => {
  const { pathname, origin } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Scurtătură: /admin → login-ul de admin (panou separat). Comod de tastat.
  if (pathname === "/admin") {
    return Response.redirect(new URL("/admin-page/login", origin));
  }

  // POARTA DE ADMIN (centralizată) — tot ce e sub /admin-page cere sesiune validă de admin, MAI PUȚIN
  // login + verify (publice prin natura magic link-ului). Backstop: orice rută NOUĂ sub /admin-page e
  // protejată automat, fără să depindă de un check în pagină. Sesiune validată în DB + email în allowlist.
  if (pathname.startsWith("/admin-page")) {
    const adminPublic =
      pathname === "/admin-page/login" ||
      pathname === "/admin-page/verify" || // pagina click-through anti-prefetch (GET inofensiv)
      pathname === "/admin-page/verify/confirm"; // consumul real al tokenului (declanșat din JS de pagina de mai sus)
    if (!adminPublic) {
      const token = req.cookies.get("detalia-admin-session")?.value;
      const email = token ? await getValidAdminSessionEmail(token) : null;
      if (!email || !isAdminEmail(email)) {
        return Response.redirect(new URL("/admin-page/login", origin));
      }
    }
    // /admin-page e deja public față de Auth.js (vezi PUBLIC_PATHS) → lăsăm restul proxy-ului să curgă
    // (CSP etc.) fără poarta de user/onboarding.
  }

  // LOCKDOWN global (mentenanță totală). Tot ce nu e /admin-page* și nu e deja ecranul de mentenanță →
  // rewrite la /maintenance (URL-ul rămâne neschimbat). Adminul intră pe /admin-page ca să-l oprească.
  // Cost: un SELECT (single-row) per request de pagină — acceptabil MVP; mentenanța e rară.
  if (!pathname.startsWith("/admin-page") && !isCronPath(pathname) && pathname !== "/maintenance") {
    const settings = await getSettingsRow();
    if (settings?.lockdownEnabled) {
      return NextResponse.rewrite(new URL("/maintenance", origin));
    }
  }

  // User logat pe landing → direct în feed. Făcut AICI (redirect 307 curat), nu în pagină:
  // un redirect() din pagină se produce în timpul streaming-ului → Next emite un meta-refresh,
  // care în unele browsere intră în buclă de reîncărcare. Middleware-ul evită complet asta.
  if (pathname === "/" && isLoggedIn) {
    return Response.redirect(new URL("/feed", origin));
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );

  // SEC-04: cont suspendat (status ≠ ACTIVE). Strategie `jwt` → status-ul de aici vine din TOKEN și e stale
  // (înghețat la login; un cont nu se poate loga suspendat → în practică e mereu ACTIVE aici). Deci acest gate
  // e SOFT. Blocarea TARE a suspendării se face pe mutații, cu re-check proaspăt din DB + signOut real —
  // vezi lib/require-active-user.ts. Păstrăm gate-ul aici ca plasă (dacă vreodată punem status proaspăt în token).
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
    // Logat fără rol, oriunde în zona protejată (INCLUSIV chiar pe /onboarding) → verificăm întâi dacă
    // userul chiar mai există în DB. Fără acest check, un cont șters (curățare/GDPR) cu JWT stale încă
    // viu rămânea „blocat" vizual logat pe /onboarding, într-o buclă fără ieșire (declareRole ar respinge
    // oricum, dar userul nu vede de ce). Delogare directă în loc de onboarding-loop.
    if (!hasRole && !isPublic && !onboardingAllowedApi) {
      const exists = await userExistsById(userId);
      if (!exists) {
        const res = Response.redirect(new URL("/login", origin));
        for (const name of ["authjs.session-token", "__Secure-authjs.session-token"]) {
          res.headers.append(
            "Set-Cookie",
            `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${name.startsWith("__Secure-") ? "; Secure" : ""}`,
          );
        }
        return res;
      }
      if (!onOnboarding) {
        return Response.redirect(new URL("/onboarding", origin));
      }
    }
    // Logat cu rol care nimerește pe onboarding → direct în feed (nu mai are ce căuta acolo).
    if (hasRole && onOnboarding) {
      return Response.redirect(new URL("/feed", origin));
    }
  }

  // SEC-08 hardening: CSP cu nonce per request. Generăm nonce, îl punem pe x-nonce (citit de RSC/layout pt
  // scripturile inline) ȘI pe headerul CSP (request + response) → Next aplică nonce-ul pe scripturile lui.
  const nonce = btoa(crypto.randomUUID());
  // Toolbar-ul Vercel (vercel.live/pusher) rulează doar pe preview → pe producție îl scoatem din CSP.
  const previewTools = process.env.VERCEL_ENV !== "production";
  const csp = buildCspHeader(nonce, process.env.NODE_ENV === "development", previewTools);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  // Rutele protejate nu intră în bfcache-ul browserului — pe un calculator partajat, „Back" după logout
  // nu mai poate reafișa pagina din cache-ul de istoric (mutațiile erau oricum blocate fără cookie;
  // asta acoperă și citirea tranzitorie).
  if (!isPublic) res.headers.set("Cache-Control", "no-store, must-revalidate");
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
