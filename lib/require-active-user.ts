// SEC-04 (varianta JWT, 2026-07-02) — blocare TARE a conturilor suspendate pe mutații.
//
// SEC-002 (2026-08-09): `proxy.ts` verifică ACUM status proaspăt din DB pe fiecare request protejat,
// inclusiv citiri — un cont suspendat e delogat la prima vizită, nu doar la prima mutație (decizie de
// produs confirmată explicit, înlocuiește vechiul gate soft pe token stale). Acest fișier rămâne ca a
// DOUA plasă, specifică server actions: proxy-ul gatează RUTE (pathname), dar un server action poate
// fi apelat dintr-o pagină deja randată înainte de suspendare (ex. tab deschis, formular vechi în DOM) —
// re-verificăm status-ul chiar pe mutație, nu doar la navigare.
//
// Întoarce userId dacă sesiunea e validă ȘI contul e ACTIVE. Altfel face redirect (nu întoarce).

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth, clearSessionCookie, signOut } from "@/lib/auth";

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
      await clearSessionCookie();
    }
  }

  return session.user.id;
}
