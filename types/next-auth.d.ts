// Augmentare tipuri Auth.js — expunem câmpuri DETALIA pe sesiune.
// `id` îl punem deja în callback-ul session; `status` îl adăugăm pentru SEC-04 (blocare conturi non-ACTIVE).
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      status: "ACTIVE" | "SUSPENDED" | "DELETED";
    } & DefaultSession["user"];
  }
}

// Strategie JWT: id + status trăiesc în token (cookie semnat), citite în callback-ul session.
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    status?: "ACTIVE" | "SUSPENDED" | "DELETED";
  }
}
