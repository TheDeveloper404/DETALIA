import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listCategories } from "@/server/services/categoryService";
import { userHasRole } from "@/server/services/roleService";

import { DetailForm } from "./detail-form";

// „Adaugă detaliu" — orice user autentificat cu ROL DECLARAT poate publica (moderare post-publicare).
export default async function NewDetailPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  // Fără rol declarat → întâi onboarding (rolul apare lângă nume și e cerut de DetailService).
  if (!(await userHasRole(session.user.id))) {
    redirect("/onboarding");
  }

  const categories = await listCategories();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Adaugă un detaliu</h1>
        <p className="text-sm text-muted-foreground">
          Publici un detaliu de execuție: titlu, context și imaginea 2D. Comunitatea îl validează pe roluri.
        </p>
      </header>

      {categories.length === 0 ? (
        <p className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Nu există încă nicio categorie. Categoriile se adaugă la pasul de seed — revino după ce sunt
          configurate.
        </p>
      ) : (
        <DetailForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      )}
    </main>
  );
}
