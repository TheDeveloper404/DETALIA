import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin-auth";

import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Admin — autentificare",
  robots: { index: false, follow: false },
};

// Pagina de login admin — magic link pe email, separat de login-ul userilor. Deja autentificat → panou.
export const dynamic = "force-dynamic";

// Mesaje pentru motivele cu care se poate ateriza înapoi aici. Lista e închisă (lookup, nu interpolare):
// `error` vine din query string, deci e input de la client și nu se randează niciodată direct.
const ERRORS: Record<string, string> = {
  link: "Link invalid sau expirat. Cere unul nou.",
  // SEC-P02 — sesiunea intermediară (între magic link și codul de verificare) a expirat sau lipsește.
  expired: "Sesiunea de autentificare a expirat. Cere un link nou.",
  locked: "Prea multe coduri greșite. Autentificarea a fost oprită — cere un link nou.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getAdminSession()) {
    redirect("/admin-page");
  }
  const { error } = await searchParams;

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-lg font-bold tracking-tight">Administrare DETALIA</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acces restricționat.</p>
      </div>
      {error && ERRORS[error] && <p className="text-sm text-destructive">{ERRORS[error]}</p>}
      <AdminLoginForm />
    </main>
  );
}
