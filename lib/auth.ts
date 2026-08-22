// Config Auth.js v5 (NextAuth) — sursa unică a autentificării DETALIA.
// Login PASSWORDLESS prin magic link (Resend). Adapter Drizzle peste Neon Postgres.
//
// Strategie sesiune = `jwt` (2026-07-02, perf): sesiunea trăiește în cookie semnat, NU se mai
// interoghează Neon la FIECARE `auth()` (fiecare render + acțiune). Adapterul rămâne pentru
// crearea userilor + verification tokens (magic link). Tabelul `sessions` nu se mai scrie.
// Tradeoff SEC-04: `status` din token e „înghețat" la login (stale până expiră). Gating-ul din
// proxy rămâne soft (status din token). Blocarea TARE a unui cont suspendat se face pe mutațiile
// care PRODUC conținut, cu re-check proaspăt din DB — vezi lib/require-active-user.ts.
//
// Valori tunable din env (niciodată hardcodate): EMAIL_FROM, MAGIC_LINK_TTL_MINUTES.
// AUTH_SECRET / AUTH_RESEND_KEY / AUTH_URL le citește Auth.js automat din env.

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { type Session } from "next-auth";
import Resend from "next-auth/providers/resend";
import { cookies } from "next/headers";

import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { magicLinkEmailHtml, magicLinkEmailText, sendEmail } from "@/lib/email";
import { resolveMagicLinkBaseUrl } from "@/lib/magic-link-url";

// TTL magic link (minute) → secunde. Default prudent: 15 min dacă env lipsește.
const magicLinkTtlMinutes = Number(process.env.MAGIC_LINK_TTL_MINUTES ?? "15");
const magicLinkMaxAgeSeconds = magicLinkTtlMinutes * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // maxAge: mărginește fereastra maximă a unui JWT (7 zile, vezi mai jos). Suspendarea/ștergerea unui
  // cont e oricum blocată IMEDIAT, nu doar la expirarea tokenului — proxy.ts verifică status proaspăt
  // din DB pe fiecare request protejat (SEC-002), iar requireActiveUserId re-verifică pe mutații.
  // Fără maxAge, default-ul Auth.js e 30 de zile.
  //
  // FIXĂ, nu culisantă (2026-08-09, decizie de produs după rescrierea proxy.ts): userul e delogat
  // forțat la 7 zile de la ULTIMUL LOGIN, nu de la ultima activitate. Înainte, `proxy.ts` reîmprospăta
  // cookie-ul la fiecare vizită (efect secundar al wrapper-ului `auth()`, eliminat pentru bug-ul de
  // sesiune resuscitată după logout — vezi CHANGELOG 2026-08-09). Middleware-ul era SINGURUL loc care
  // făcea asta — CONFIRMAT (CR-001, code-review PR #215) în docs Auth.js (authjs.dev/guides/upgrade-to-v5):
  // rotația de `exp` se întâmplă doar când `auth()` e apelat CU un `res`/context de scris răspunsul (API
  // routes, `getServerSideProps`, middleware). În App Router, Server Actions/RSC apelează `auth()` FĂRĂ
  // argumente — n-au niciun `res` la care să atașeze un `Set-Cookie` nou, deci nu rotesc nimic. Aplicația
  // n-are `SessionProvider`
  // client-side. Acceptat conștient: 7 zile fixe e generos, echivalent cu re-login săptămânal.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  trustHost: true,
  // Pagini custom: folosim ecrane proprii în limbajul vizual DETALIA în loc de cele default Auth.js.
  pages: {
    signIn: "/login",
    // signIn callback care întoarce false (cont suspendat) → Auth.js redirectează aici cu ?error=AccessDenied.
    error: "/login",
    // „Verifică-ți email-ul" după cererea magic link-ului (înlocuiește pagina default întunecată/engleză).
    verifyRequest: "/verify-request",
  },
  providers: [
    Resend({
      from: process.env.EMAIL_FROM,
      maxAge: magicLinkMaxAgeSeconds,
      // Email brand DETALIA pentru magic link (înlocuiește template-ul default Resend).
      async sendVerificationRequest({ identifier: email, url, request }) {
        // Anti-prefetch FĂRĂ click în plus: emailul trimite linkul către /verify, care se
        // auto-confirmă din JS la încărcare (window.location → callback-ul Auth.js). Un browser real
        // rulează JS → ajunge instant în feed. Scanerele de securitate ale clienților de mail fac GET
        // pe pagină dar NU rulează JS → nu consumă tokenul one-time. Vezi app/verify/page.tsx.
        const base = resolveMagicLinkBaseUrl(request);
        const clickThroughUrl = `${base}/verify?u=${encodeURIComponent(url)}`;
        const ok = await sendEmail({
          to: email,
          subject: "Conectează-te în DETALIA",
          html: magicLinkEmailHtml(clickThroughUrl, magicLinkTtlMinutes),
          text: magicLinkEmailText(clickThroughUrl, magicLinkTtlMinutes),
        });
        if (!ok) throw new Error("MAGIC_LINK_EMAIL_FAILED");
      },
    }),
    // Google OAuth scos, rămâne doar magic link. Schela de provider se poate readăuga ulterior.
  ],
  callbacks: {
    // SEC-04: blochează conturile non-ACTIVE (suspendate). La email provider, signIn se cheamă de două ori
    // (la trimiterea magic link-ului ȘI la click) → refuzăm în ambele. `user` vine din DB (strategie database);
    // un user NOU (signup) n-are încă `status` aici → permis (adapterul îl creează cu default ACTIVE).
    signIn({ user }) {
      const status = (user as { status?: string } | null)?.status;
      if (status && status !== "ACTIVE") return false;
      return true;
    },
    // La sign-in, `user` vine din DB (adapter) → punem id + status în token (o singură dată).
    // La cererile următoare `user` lipsește; token-ul se citește din cookie (fără query Neon).
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.status = (user as { status?: Session["user"]["status"] }).status ?? "ACTIVE";
      }
      return token;
    },
    // Cu strategie `jwt`, callback-ul primește `token` (din cookie), NU user-ul din DB.
    // Expunem `user.id` (authz server, deny-by-default) și `user.status`. `status` NU mai e citit din
    // token pentru gating (SEC-002, 2026-08-09: proxy.ts verifică status proaspăt din DB pe fiecare
    // request protejat, inclusiv citiri — vezi proxy.ts) — rămâne aici doar ca fallback afișat în UI.
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? (token.sub as string);
        session.user.status = (token.status as Session["user"]["status"]) ?? "ACTIVE";
      }
      return session;
    },
  },
});

// SEC-001 (2026-08-09): ștergere EXPLICITĂ a cookie-ului de sesiune, apelabilă din orice server action
// care trebuie să garanteze delogarea (nu doar redirecționeze spre o pagină client care o face).
// `cookieStore.delete(name)` NU acceptă opțiuni → Set-Cookie-ul de ștergere iese FĂRĂ `Secure`, iar un
// cookie cu prefix `__Secure-` e respins de browser dacă Set-Cookie-ul care-l atinge nu are `Secure`
// (regulă de spec) → ștergerea era ignorată silențios (bug confirmat prin trace, 2026-07-08). Fix:
// `set()` cu `maxAge: 0` + aceleași atribute ca la emitere. Extras din lib/require-active-user.ts,
// unde acest pattern era deja verificat, ca să nu se dubleze la fiecare punct nou de logout.
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("authjs.session-token") || c.name.startsWith("__Secure-authjs.session-token")) {
      cookieStore.set(c.name, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        secure: c.name.startsWith("__Secure-"),
        sameSite: "lax",
      });
    }
  }
}
