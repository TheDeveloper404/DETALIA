import { type NextRequest, NextResponse } from "next/server";

import { verifyAdminLoginToken } from "@/lib/admin-auth";

// Consumă magic link-ul de admin: token valid → creează sesiunea (cookie) → panou. Altfel → login cu eroare.
// GET (link din email). Token-ul e one-time (consumat în verifyAdminLoginToken).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const ok = token ? await verifyAdminLoginToken(token) : false;

  const dest = ok ? "/admin-page" : "/admin-page/login?error=link";
  return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
}
