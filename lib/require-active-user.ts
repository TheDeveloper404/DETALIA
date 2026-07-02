// SEC-04 (varianta JWT, 2026-07-02) — blocare TARE a conturilor suspendate pe mutații.
//
// Cu sesiune `jwt` (vezi lib/auth.ts), `session.user.status` vine din token și e stale (înghețat la
// login). Reads/render-ele NU plătesc niciun query de sesiune — acolo e câștigul de performanță.
// Dar un cont suspendat NU trebuie să mai poată PRODUCE conținut din secunda suspendării. De aceea,
// pe mutațiile care produc/modifică conținut (comentarii, validări, detalii, schițe) re-verificăm
// status-ul PROASPĂT din DB — un singur SELECT ușor, plătit doar de acele acțiuni rare.
//
// Întoarce userId dacă sesiunea e validă ȘI contul e ACTIVE. Altfel face redirect (nu întoarce).

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function requireActiveUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [row] = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Cont inexistent (șters) sau non-ACTIVE (suspendat) → tratat ca acces refuzat, la fel ca proxy-ul.
  if (!row || row.status !== "ACTIVE") redirect("/login?error=AccessDenied");

  return session.user.id;
}
