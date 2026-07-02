// Config Auth.js v5 (NextAuth) — sursa unică a autentificării DETALIA.
// Login PASSWORDLESS prin magic link (Resend). Adapter Drizzle peste Neon Postgres.
//
// Strategie sesiune = `database` (implicit cu adapter): folosim tabelul `sessions` din schemă.
// E sigur să rulăm acest config și în middleware (edge) fiindcă driverul Neon (HTTP/fetch)
// este edge-compatible → NU avem nevoie de split-config auth.config.ts + JWT.
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
  session: { strategy: "database" },
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
    // Cu strategie `database`, callback-ul primește user-ul din DB.
    // Expunem `user.id` (authz server, deny-by-default) și `user.status` (SEC-04: gating în proxy).
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.status = (user as { status?: Session["user"]["status"] }).status ?? "ACTIVE";
      }
      return session;
    },
  },
});
