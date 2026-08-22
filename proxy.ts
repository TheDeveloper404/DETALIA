// Proxy (Next.js 16 — fostul „middleware") — DENY-BY-DEFAULT: tot ce nu e explicit
// public cere sesiune. Frontend-ul NU e sursa de adevăr; asta e doar prima poartă
// (gating de rute). Authz fină (rol, ownership) se face în services pe server, nu aici.
//
// Citește token-ul de sesiune direct cu `getToken()` (edge-safe) — NU cu wrapper-ul `auth()` din
// lib/auth.ts (vezi comentariul CRITIC de mai jos, la definiția funcției).

import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isAdminEmail } from "@/lib/admin-allowlist";
import { hashToken } from "@/lib/admin-token-hash";
import { audit } from "@/lib/audit";
import { createCachedSettingsReader } from "@/lib/cached-settings-reader";
import { buildCspHeader } from "@/lib/csp";
import { getValidAdminSessionEmail } from "@/server/repos/adminsRepo";
import { getSettingsRow } from "@/server/repos/settingsRepo";
import { getUserGateInfo } from "@/server/repos/usersRepo";
import { isPublicPath } from "@/lib/public-paths";

// Rutele de cron invocate de Vercel (fără sesiune de user) — autorizare reală prin CRON_SECRET, în
// handler. EXACTE (nu un prefix larg gen "/api/cron"), ca o rută cron nouă să NU devină public/scutită de
// lockdown implicit doar pentru că împarte prefixul — adaugi aici explicit, o dată cu handler-ul nou.
const CRON_PATHS = ["/api/cron/cleanup-notifications"];

// Prefixe publice (accesibile fără sesiune). Restul = protejat.
const PUBLIC_PATHS = [
  "/", // landing
  "/login", // autentificare (magic link)
  // Delogare reală (2026-08-09) — vezi comentariul din app/(app)/profile/actions.ts. Public INTENȚIONAT:
  // pagina trebuie să funcționeze indiferent de starea sesiunii (inclusiv cont tocmai șters, cu JWT stale
  // dar tehnic încă „valid" până la clear-ul real de-acolo) — nicio poartă de-aici nu trebuie s-o blocheze.
  "/logout",
  "/signup", // înregistrare publică (magic link)
  "/verify-request", // „verifică-ți email-ul" după cererea magic link-ului (pre-auth)
  "/verify", // auto-confirmare magic link (JS redirect → callback); inertă la GET automat de scanner (pre-auth)
  "/maintenance", // ecranul „site în lucru" (ținta rewrite-ului de lockdown) — public by design
  "/s", // teaser PUBLIC read-only al unei schițe (decizie 2026-07-05) — vezi app/s/[id]/page.tsx
  // Invitație de proiect (2026-08-09) — public INTENȚIONAT: un vizitator FĂRĂ cont trebuie să vadă
  // „ai fost invitat în X" înainte de autentificare. STRICT „/projects/join" (nu "/projects" simplu —
  // acela rămâne protejat, e lista proiectelor userului).
  "/projects/join",
  "/termeni", // Termeni și condiții — public, linkuit din footer
  "/confidentialitate", // Notă de confidențialitate (GDPR) — public, linkuit din footer
  "/ingest", // proxy PostHog (evită ad-blockere) — trebuie accesibil pre-auth (pageview pe landing/login/signup)
  "/.well-known/security.txt", // canal RFC 9116 de raportare responsabilă — public prin natura lui
  // Panoul de admin are AUTENTIFICARE PROPRIE (lib/admin-auth.ts), separată de Auth.js. Îl scutim de
  // poarta de user (altfel ar fi redirectat la /login-ul userilor). Gating-ul real e în paginile /admin-page.
  "/admin-page",
  ...CRON_PATHS,
];

const isCronPath = (pathname: string) => CRON_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

// Gate-ul de lockdown citea din DB la FIECARE request de pagină (cost + un eșec tranzitoriu de DB îl
// flip-uia pe fallback). Cache per-instanță cu TTL scurt + ultima valoare bună (2026-07-18) — lockdown-ul
// pornit/oprit de admin se propagă în cel mult TTL, acceptabil pt un buton de mentenanță. DOAR aici, pe
// calea fierbinte: adminul (upsert) și restul căilor citesc în continuare direct din repo, proaspăt.
const SETTINGS_CACHE_TTL_MS = Number(process.env.SETTINGS_CACHE_TTL_MS ?? 30_000);
const getSettingsForGate = createCachedSettingsReader(getSettingsRow, SETTINGS_CACHE_TTL_MS);

// CRITIC (2026-08-09, cauză confirmată din trace.zip + sursa @auth/core): NU mai folosim wrapper-ul
// `auth()` aici. `auth()` „rotește" (re-emite) cookie-ul de sesiune ca efect secundar al citirii —
// pe ORICE request care trece prin acest middleware, inclusiv trafic de fundal (prefetch-uri Next.js
// pentru linkurile din header). Concurent cu un `signOut()` real (chiar mutat pe `/logout`, izolat de
// restul), un asemenea request putea RESUSCITA o sesiune tocmai delogată, re-emițând un cookie valid
// DUPĂ ștergerea deliberată — reprodus direct în e2e (`account-deletion.spec.ts`), nu teoretizat.
//
// `getToken()` doar CITEȘTE token-ul (decriptează cookie-ul existent), fără să scrie niciun Set-Cookie —
// elimină sursa rotirii la rădăcină, pentru tot middleware-ul, nu doar pentru fluxul de logout.
export default async function proxy(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // SEC-003: aplicația nu folosește deloc autentificare Bearer — doar cookie HttpOnly. `getToken()`
  // citește implicit și header-ul `Authorization: Bearer <jwt>` dacă cookie-ul lipsește (spre deosebire
  // de vechiul `auth()`, care citea strict cookie-uri). Tăiem header-ul explicit înainte de citire, ca
  // un token exfiltrat separat de cookie (log, trace, mașină partajată) să nu poată fi refolosit ca
  // bearer token cross-origin, fără protecția SameSite a cookie-ului.
  const tokenHeaders = new Headers(req.headers);
  tokenHeaders.delete("authorization");
  const tokenReq = { headers: tokenHeaders };
  // SEC-04 (secureCookie, determinat din protocolul REAL al requestului, ca în e2e/auth.setup.ts, NU din
  // NODE_ENV — verificat direct în sursa @auth/core/jwt.js: implicit e `false`, omis pe https ar căuta
  // cookie-ul FĂRĂ prefixul `__Secure-` și ar delogă silențios TOȚI userii) determină și numele cookie-ului
  // citit. SEC-004: dacă requestul intern nu are `x-forwarded-proto` corect (proxy/health-check), încercăm
  // și varianta cealaltă înainte să tratăm userul ca delogat — fail-closed doar dacă ambele lipsesc.
  const isHttps = req.nextUrl.protocol === "https:";
  const authToken =
    (await getToken({ req: tokenReq, secret: process.env.AUTH_SECRET, secureCookie: isHttps })) ??
    (await getToken({ req: tokenReq, secret: process.env.AUTH_SECRET, secureCookie: !isHttps }));
  const isLoggedIn = !!authToken;
  // Aceeași regulă de fallback ca fostul callback `session()` din lib/auth.ts (id, cu sub ca rezervă).
  const userId = authToken?.id ?? authToken?.sub;

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
      const adminToken = req.cookies.get("detalia-admin-session")?.value;
      // Cookie-ul poartă tokenul BRUT, coloana stochează hash-ul (SEC-01) → căutarea trebuie hash-uită.
      // Fără `hashToken` aici, poarta nu recunoștea nicio sesiune validă și redirecta la login, iar
      // pagina de login (care hash-uia corect) redirecta înapoi → buclă infinită, panou inaccesibil.
      const email = adminToken ? await getValidAdminSessionEmail(hashToken(adminToken)) : null;
      if (!email || !isAdminEmail(email)) {
        return Response.redirect(new URL("/admin-page/login", origin));
      }
    }
    // /admin-page e deja public față de Auth.js (vezi PUBLIC_PATHS) → lăsăm restul proxy-ului să curgă
    // (CSP etc.) fără poarta de user/onboarding.
  }

  // LOCKDOWN global (mentenanță totală). Tot ce nu e /admin-page* și nu e deja ecranul de mentenanță →
  // rewrite la /maintenance (URL-ul rămâne neschimbat). Adminul intră pe /admin-page ca să-l oprească.
  // Cost: un SELECT la cel mult un TTL (cache-ul de mai sus), nu per request.
  if (!pathname.startsWith("/admin-page") && !isCronPath(pathname) && pathname !== "/maintenance") {
    const settings = await getSettingsForGate();
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

  // SEC-05: „/projects/join” și „/s” n-au sens ca path exact (cer strict un token/id după) — dacă
  // sunt accesate exact (fără segment), NU trebuie tratate ca publice (vezi lib/public-paths.ts).
  const isPublic = isPublicPath(pathname, PUBLIC_PATHS, ["/projects/join", "/s"]);

  // Neautentificat pe rută protejată → redirect la login, cu callback de revenire.
  if (!isPublic && !isLoggedIn) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  // POARTA DE STATUS + ONBOARDING (deny-by-default), pe date PROASPETE din DB, nu din token.
  // Făcută AICI — nu în `app/(app)/layout.tsx` — din EXACT același motiv ca redirect-ul de landing de mai
  // sus: un `redirect()` din layout în timpul streaming-ului RSC degenerează în meta-refresh → buclă de
  // loading (onboarding ⇄ feed). Proxy-ul dă un 307 curat, fără buclă.
  //
  // SEC-002 (2026-08-09, security-engineer review PR #215): gate-ul de status era pe `authToken.status`,
  // înghețat la login și stale până la max 7 zile (vezi lib/auth.ts). Poarta de onboarding făcea deja un
  // query (`userHasRole`) pe fiecare request al unui user logat pe zonă protejată — costul marginal al
  // unui status proaspăt în ACELAȘI SELECT (LEFT JOIN, vezi getUserGateInfo) e ~zero, deci nu mai există
  // motiv să rămână pe date stale. Închide și cazul „cont DELETED cu rol încă în DB" (vechiul check de
  // existență rula DOAR pe ramura `!hasRole` — un cont șters care păstra un rând `roles` orfan trecea
  // nedetectat de poarta veche).
  if (isLoggedIn && userId && !isPublic) {
    const gate = await getUserGateInfo(userId);

    // Cont dispărut din DB (curățare/GDPR) cu JWT încă tehnic valid → delogare directă, nu buclă de
    // onboarding (declareRole ar respinge oricum, dar userul nu vede de ce).
    if (!gate || gate.status !== "ACTIVE") {
      if (gate) {
        // SEC-14: cont non-ACTIVE a încercat o rută protejată → audit (userId = uuid intern, fără PII brut).
        audit("access_denied_suspended", { userId, status: gate.status, path: pathname }, "warning");
      }
      // BUG confirmat din Vercel runtime logs (2026-08-09): `Response.redirect()` întoarce un Response cu
      // headers IMUABILE (guard din spec Fetch) — `res.headers.append("Set-Cookie", ...)` arunca
      // `TypeError: immutable`, proxy-ul crăpa cu 500 în loc să redirecteze, iar userul suspendat rămânea
      // pe pagina protejată (500 ≠ navigare, browserul nu schimbă URL-ul). `NextResponse.redirect()` +
      // `res.cookies` NU au acest guard — API idiomatic Next.js, nu construim Set-Cookie de mână.
      const res = NextResponse.redirect(new URL("/login?error=AccessDenied", origin));
      for (const name of ["authjs.session-token", "__Secure-authjs.session-token"]) {
        res.cookies.set(name, "", {
          path: "/",
          maxAge: 0,
          httpOnly: true,
          sameSite: "lax",
          secure: name.startsWith("__Secure-"),
        });
      }
      return res;
    }

    const onOnboarding = pathname === "/onboarding";
    // Excepție la poarta de rol: uploadul de imagine (avatar/cover) se face CHIAR în onboarding,
    // înainte de a avea rol. Ruta `/api/blob/upload` cere oricum sesiune (deny-by-default în handler),
    // deci e sigur s-o lăsăm să treacă fără rol — altfel poza din onboarding e redirectată (302) și eșuează.
    const onboardingAllowedApi = pathname === "/api/blob/upload";
    if (!gate.hasRole && !onboardingAllowedApi && !onOnboarding) {
      return Response.redirect(new URL("/onboarding", origin));
    }
    // Logat cu rol care nimerește pe onboarding → direct în feed (nu mai are ce căuta acolo).
    if (gate.hasRole && onOnboarding) {
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
}

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
