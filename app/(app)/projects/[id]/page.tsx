import { Users } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  getProjectForViewer,
  listCanvasSharesUnchecked,
  listProjectDetailsUnchecked,
  listReleasedDetailsUnchecked,
} from "@/server/services/projectService";
import { listMyCanvases } from "@/server/services/plansaService";

import { ContentGrid } from "./content-grid";
import { EditableProjectName } from "./editable-project-name";
import { InviteMembersButton, MembersList, ProjectMenu } from "./project-panel";

// Pagina unui proiect — nucleul colaborării restrânse. Acces: owner SAU membru activ (verificat în
// getProjectForViewer — `null` pentru oricine altcineva, aceeași formă ca „proiect inexistent").
// Redesign 2026-08-11 (Faza B + feedback direct testat pe platformă): nume editabil inline, meniu ⋮ (Șterge), link de
// invitație ascuns după un buton, membri cu poză+rol, grid matrice Detalii/Planșe cu „+" — fără
// butonul separat „Adaugă detaliu" de dinainte.
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const { id } = await params;
  const view = await getProjectForViewer({ projectId: id, userId });
  if (!view) notFound();

  // Acces DEJA verificat mai sus (`getProjectForViewer` — `notFound()` dacă lipsește) — variantele
  // „Unchecked" evită re-verificarea de 3 ori în plus, fiecare cu propriul query în DB.
  const [details, releasedDetails, canvasShares, myCanvases] = await Promise.all([
    listProjectDetailsUnchecked(id),
    listReleasedDetailsUnchecked(id),
    listCanvasSharesUnchecked(id),
    listMyCanvases(userId),
  ]);

  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] flex-1 px-6 pb-20 pt-8">
      <nav className="mb-[18px] flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          Proiectele mele
        </Link>
        <span className="text-[#cabfac]">/</span>
        <span className="text-foreground/70">{view.project.name}</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Users className="size-5 shrink-0 text-primary" strokeWidth={2} />
          <EditableProjectName
            projectId={view.project.id}
            initialName={view.project.name}
            editable={view.isOwner}
          />
        </div>
        <div className="flex items-center gap-2">
          {view.isOwner && (
            <InviteMembersButton projectId={view.project.id} initialToken={view.project.inviteToken} />
          )}
          {view.isOwner && <ProjectMenu projectId={view.project.id} />}
        </div>
      </div>

      {view.owner && (
        <div className="mb-4">
          <MembersList
            owner={{
              userId: view.owner.id,
              name: view.owner.name,
              image: view.owner.image,
              roleMain: view.owner.roleMain,
              subRole: view.owner.subRole,
              verified: view.owner.verified,
            }}
            members={view.members.map((m) => ({
              userId: m.userId,
              name: m.name,
              image: m.image,
              roleMain: m.roleMain,
              subRole: m.subRole,
              verified: m.verified,
            }))}
            isOwner={view.isOwner}
            projectId={view.project.id}
          />
        </div>
      )}

      <ContentGrid
        projectId={view.project.id}
        isMember
        details={(details ?? []).map((d) => ({ id: d.id, title: d.title, imageUrl: d.imageUrl }))}
        releasedDetails={(releasedDetails ?? []).map((d) => ({
          id: d.id,
          title: d.title,
          imageUrl: d.imageUrl,
        }))}
        canvasShares={(canvasShares ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          imageUrl: s.imageUrl,
          sharedByUserId: s.sharedByUserId,
        }))}
        myCanvases={myCanvases.map((c) => ({ id: c.id, name: c.name, thumbnailUrl: c.thumbnailUrl }))}
        isOwner={view.isOwner}
        currentUserId={userId}
      />
    </main>
  );
}
