import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin-auth";

import { AdminLoginForm } from "./login-form";

// Pagina de login admin — magic link pe email, separat de login-ul userilor. Deja autentificat → panou.
export const dynamic = "force-dynamic";

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
      {error === "link" && (
        <p className="text-sm text-destructive">Link invalid sau expirat. Cere unul nou.</p>
      )}
      <AdminLoginForm />
    </main>
  );
}
