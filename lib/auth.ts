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
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";

import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

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
  // Pagini custom: folosim /login în loc de pagina default Auth.js (/api/auth/signin).
  // verifyRequest („verifică email-ul") rămâne pe default-ul Auth.js deocamdată.
  pages: {
    signIn: "/login",
  },
  providers: [
    Resend({
      from: process.env.EMAIL_FROM,
      maxAge: magicLinkMaxAgeSeconds,
    }),
    // Google OAuth scos pentru MVP (rămâne doar magic link). Schela de provider se poate readăuga ulterior.
  ],
  callbacks: {
    // Cu strategie `database`, callback-ul primește user-ul din DB.
    // Expunem `user.id` în sesiune — necesar pentru authz pe server (deny-by-default).
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
