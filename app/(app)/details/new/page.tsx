import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listCategories } from "@/server/services/categoryService";
import { listMyCanvases } from "@/server/services/plansaService";
import { userHasRole } from "@/server/services/roleService";
import { getProjectForViewer, listCanvasSharesUnchecked } from "@/server/services/projectService";

import { DetailForm } from "./detail-form";
import { saveNewDetailDraftAction } from "./actions";

// „Adaugă detaliu" — orice user autentificat cu ROL DECLARAT poate publica (moderare post-publicare).
// `?projectId=X` (2026-08-09): publicare într-un proiect în loc de comunitate — vezi
// server/domain/project.ts. Fără rol în URL: o ciornă nu poate avea proiect (invarianta), deci
// butonul „Salvează ciornă" dispare complet în acest mod (vezi mai jos).
export const metadata: Metadata = { title: "Detaliu nou" };

export default async function NewDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  // Fără rol declarat → întâi onboarding (rolul apare lângă nume și e cerut de DetailService).
  if (!(await userHasRole(session.user.id))) {
    redirect("/onboarding");
  }

  const { projectId } = await searchParams;
  // Re-verificare pe server (nu doar UI): un userId care nu mai e membru (link vechi, eliminat între
  // timp) nu ajunge nici măcar la formular — createDetailAction verifică din nou la submit oricum,
  // dar aici evităm să arătăm formularul degeaba.
  const project = projectId
    ? await getProjectForViewer(projectId, session.user.id)
    : null;
  if (projectId && !project) notFound();

  // §7 din plan (Faza C): a treia sursă de imagine la creare — „dintr-o planșă" proprie. Fără gardă
  // suplimentară de acces (decizie explicită din plan): `listMyCanvases` întoarce STRICT planșele
  // userului curent, aceeași sursă folosită deja de `/canvases`.
  // În context de proiect (`projectId` prezent): și planșele PARTAJATE ale proiectului (§6B/Faza B) —
  // „ori din planșele mele SAU ALE ALTORA la care am acces" (cerință explicită la creare în proiect).
  // Acces deja verificat mai sus (`project` = null dacă nu ești membru) — varianta „Unchecked" evită
  // re-verificarea, nu doar accesul (2026-08-11, /code-review — același gol ca pe pagina de proiect).
  // Cele trei sunt independente — Promise.all evită 3 round-trip-uri secvențiale (2026-08-11, /code-review).
  const [categories, myCanvases, canvasShares] = await Promise.all([
    listCategories(),
    listMyCanvases(session.user.id),
    projectId ? listCanvasSharesUnchecked(projectId) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] flex-1 px-6 pb-20 pt-8">
      {/* breadcrumb */}
      <nav className="mb-[18px] flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Link href={project ? `/projects/${project.project.id}` : "/feed"} className="hover:text-foreground">
          {project ? project.project.name : "Detalii"}
        </Link>
        <span className="text-[#cabfac]">/</span>
        <span className="text-foreground/70">Adaugă un detaliu</span>
      </nav>

      <h1 className="mb-2 text-center font-heading text-[30px] font-extrabold tracking-tight">
        Adaugă un detaliu
      </h1>
      <p className="mb-7 mx-auto max-w-[58ch] text-center text-[15px] leading-relaxed text-muted-foreground">
        {project ? (
          <>
            Publici în proiectul <strong>{project.project.name}</strong> — vizibil doar membrilor,
            nu în comunitate.
          </>
        ) : (
          "Pui un detaliu de execuție la dezbatere. Publici desenul cu o descriere, breasla îl cântărește pe roluri — fără coadă de aprobare."
        )}
      </p>

      {categories.length === 0 ? (
        <p className="rounded-[10px] border border-border bg-muted/50 px-3.5 py-2.5 text-sm text-muted-foreground">
          Nu există încă nicio categorie. Categoriile se adaugă la pasul de seed — revino după ce sunt
          configurate.
        </p>
      ) : (
        <DetailForm
          categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, isGroup: c.isGroup }))}
          // Ciornă = mereu personală (invarianta din server/domain/project.ts) — butonul dispare
          // complet când publicăm într-un proiect.
          saveDraftAction={project ? undefined : saveNewDetailDraftAction}
          projectId={project?.project.id}
          submitLabel={project ? "Publică în proiect" : undefined}
          myCanvases={[
            ...myCanvases.map((c) => ({ id: c.id, name: c.name, thumbnailUrl: c.thumbnailUrl })),
            ...canvasShares.map((s) => ({ id: s.id, name: `${s.name} (partajată)`, thumbnailUrl: s.imageUrl })),
          ]}
        />
      )}
    </main>
  );
}
