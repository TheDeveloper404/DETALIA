import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <main className="flex flex-1 flex-col items-center justify-center p-6 sm:p-8">
      <Card className="w-full max-w-sm gap-6 py-6">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bun venit în DETALIA</CardTitle>
          <CardDescription>
            Spune-ne cine ești. Rolul tău apare lângă nume și ajută comunitatea să-ți
            cântărească corect părerea.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          <RoleForm />

          <p className="text-center text-xs text-muted-foreground">
            Îți poți verifica rolul mai târziu, din profil. Nu e obligatoriu acum.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
