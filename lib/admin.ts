// Authz admin — un user e admin DOAR dacă emailul lui e în allowlist-ul ADMIN_EMAILS (env).
// Deny-by-default: env gol → niciun admin. Admin = user normal cu puteri seed/verificare;
// nu există coloană `is_admin` în DB (decizie: allowlist din env, fără migrație, reversibil).
import type { Session } from "next-auth";

import { auth } from "@/lib/auth";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

export function isAdminSession(session: Session | null): boolean {
  return isAdminEmail(session?.user?.email);
}

// Guard pentru rute/acțiuni admin. Aruncă dacă userul curent NU e admin (deny-by-default).
// Callerul decide cum tratează (403 pe API, redirect pe pagină).
export async function requireAdmin(): Promise<Session> {
  const session = await auth();
  if (!session || !isAdminEmail(session.user?.email)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}
