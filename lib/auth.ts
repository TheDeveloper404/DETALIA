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

import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { magicLinkEmailHtml, magicLinkEmailText, sendEmail } from "@/lib/email";

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
  // maxAge: mărginește fereastra în care un JWT cu status stale (ACTIVE la login) mai poate CITI
  // conținut protejat după o suspendare/ștergere de cont — mutațiile sunt oricum blocate imediat de
  // requireActiveUserId (re-check DB). Fără maxAge, default-ul Auth.js e 30 de zile.
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
      async sendVerificationRequest({ identifier: email, url }) {
        // Anti-prefetch FĂRĂ click în plus: emailul trimite linkul către /verify, care se
        // auto-confirmă din JS la încărcare (window.location → callback-ul Auth.js). Un browser real
        // rulează JS → ajunge instant în feed. Scanerele de securitate ale clienților de mail fac GET
        // pe pagină dar NU rulează JS → nu consumă tokenul one-time. Vezi app/verify/page.tsx.
        const base = process.env.AUTH_URL ?? "http://localhost:3000";
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
    // Google OAuth scos pentru MVP (rămâne doar magic link). Schela de provider se poate readăuga ulterior.
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
    // Expunem `user.id` (authz server, deny-by-default) și `user.status` (SEC-04: gating SOFT în proxy;
    // status-ul poate fi stale — blocarea tare a suspendării se face pe mutații, vezi require-active-user.ts).
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? (token.sub as string);
        session.user.status = (token.status as Session["user"]["status"]) ?? "ACTIVE";
      }
      return session;
    },
  },
});
