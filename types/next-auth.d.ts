// Augmentare tipuri Auth.js — expunem câmpuri DETALIA pe sesiune.
// `id` îl punem deja în callback-ul session; `status` îl adăugăm pentru SEC-04 (blocare conturi non-ACTIVE).
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      status: "INVITED" | "ACTIVE" | "SUSPENDED" | "DELETED";
    } & DefaultSession["user"];
  }
}
