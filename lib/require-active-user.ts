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
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth, signOut } from "@/lib/auth";

export async function requireActiveUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [row] = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Cont inexistent (șters) sau non-ACTIVE (suspendat): NU doar redirect — facem signOut REAL, ca să ștergem
  // cookie-ul JWT. Altfel tokenul (cu status stale=ACTIVE) ar rămâne viu și userul ar putea reveni la citire
  // cu „back". Așa, prima încercare de mutație a unui cont suspendat = delogare completă (blocat și pe citire).
  if (!row || row.status !== "ACTIVE") {
    // signOut({ redirectTo }) își scrie PROPRIUL Set-Cookie (re-emite un token) și aruncă NEXT_REDIRECT.
    // Dacă ștergerea noastră explicită rulează ÎNAINTE de signOut(), Set-Cookie-ul lui vine ULTIMUL pe
    // wire și anulează ștergerea (bug confirmat prin trace Playwright, 2026-07-08: cookie-ul supraviețuia
    // la testul de suspendare). Fix: ștergerea rulează în `finally`, deci DUPĂ ce signOut() și-a scris
    // header-ele lui, dar tot înainte ca redirect-ul (NEXT_REDIRECT re-aruncat) să ajungă la client —
    // ștergerea noastră e mereu ULTIMUL Set-Cookie pentru acest nume.
    try {
      await signOut({ redirectTo: "/login?error=AccessDenied" });
    } finally {
      const cookieStore = await cookies();
      for (const c of cookieStore.getAll()) {
        if (c.name.startsWith("authjs.session-token") || c.name.startsWith("__Secure-authjs.session-token")) {
          cookieStore.delete(c.name);
        }
      }
    }
  }

  return session.user.id;
}
