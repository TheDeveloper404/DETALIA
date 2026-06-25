import Link from "next/link";
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
    <main className="mx-auto w-full max-w-[760px] flex-1 px-6 pb-20 pt-8">
      {/* breadcrumb */}
      <nav className="mb-[18px] flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Link href="/feed" className="hover:text-foreground">
          Detalii
        </Link>
        <span className="text-[#cabfac]">/</span>
        <span className="text-foreground/70">Adaugă un detaliu</span>
      </nav>

      <h1 className="mb-2 font-heading text-[30px] font-extrabold tracking-tight">
        Adaugă un detaliu
      </h1>
      <p className="mb-7 max-w-[58ch] text-[15px] leading-relaxed text-muted-foreground">
        Pui un detaliu de execuție la dezbatere. Publici desenul cu o descriere, breasla îl
        cântărește pe roluri — fără coadă de aprobare.
      </p>

      {categories.length === 0 ? (
        <p className="rounded-[10px] border border-border bg-muted/50 px-3.5 py-2.5 text-sm text-muted-foreground">
          Nu există încă nicio categorie. Categoriile se adaugă la pasul de seed — revino după ce sunt
          configurate.
        </p>
      ) : (
        <DetailForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      )}
    </main>
  );
}
