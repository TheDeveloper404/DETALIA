// Token opac de invitație la proiect — generare, izolat (fără `next/headers`, ca să poată fi
// importat și din contexte care nu au nevoie de cookie-uri, ex. server actions de join).
//
// Stocat BRUT în DB (nu hash — vezi comentariul din db/schema.ts la `projects.inviteToken` pentru
// motiv): e un link de partajare persistent, nu o credențială de autentificare one-time. Entropia
// (32 bytes = 256 biți random, aceeași ca la tokenurile de admin, lib/admin-auth.ts) e apărarea —
// neghicibil, nu needevoalabil.
import { randomBytes } from "node:crypto";

import { INVITE_TOKEN_BYTES } from "@/server/domain/project";

export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString("hex");
}
