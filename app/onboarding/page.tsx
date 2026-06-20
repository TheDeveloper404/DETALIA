import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { userHasRole } from "@/server/services/roleService";

import { RoleForm } from "./role-form";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  // Cine are deja rol nu mai trece prin onboarding.
  if (await userHasRole(session.user.id)) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <header className="text-center flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Bun venit în DETALIA</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Spune-ne cine ești. Rolul tău apare lângă nume și ajută comunitatea să-ți
            cântărească corect părerea.
          </p>
        </header>

        <RoleForm />

        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          Îți poți verifica rolul mai târziu, din profil. Nu e obligatoriu acum.
        </p>
      </div>
    </main>
  );
}
