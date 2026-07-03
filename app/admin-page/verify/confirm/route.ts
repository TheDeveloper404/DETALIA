import { type NextRequest, NextResponse } from "next/server";

import { verifyAdminLoginToken } from "@/lib/admin-auth";

// Consumă magic link-ul de admin: token valid → creează sesiunea (cookie) → panou. Altfel → login cu eroare.
// SEC-A1: emailul NU mai trimite direct aici — trimite la pagina /admin-page/verify (inofensivă la GET),
// care declanșează acest consum DIN JAVASCRIPT (anti-prefetch: scanerele de mail nu rulează JS → nu mai
// consumă tokenul one-time și nu mai provoacă emiterea unei sesiuni). Același pattern ca /verify (useri).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const ok = token ? await verifyAdminLoginToken(token) : false;

  const dest = ok ? "/admin-page" : "/admin-page/login?error=link";
  return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
}
