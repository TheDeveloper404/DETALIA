import { Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getProjectForViewer, listProjectDetailsForViewer } from "@/server/services/projectService";

import { DeleteProjectButton, InviteLinkBox, RemoveMemberButton } from "./project-panel";

// Pagina unui proiect — nucleul colaborării restrânse. Acces: owner SAU membru activ (verificat în
// getProjectForViewer — `null` pentru oricine altcineva, aceeași formă ca „proiect inexistent").
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const view = await getProjectForViewer({ projectId: id, userId: session.user.id });
  if (!view) notFound();

  const details = await listProjectDetailsForViewer({ projectId: id, userId: session.user.id });

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
          <Users className="size-5 text-primary" strokeWidth={2} />
          <h1 className="font-heading text-[26px] font-extrabold tracking-tight">{view.project.name}</h1>
        </div>
        <Link
          href={`/details/new?projectId=${view.project.id}`}
          className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground no-underline"
        >
          Adaugă detaliu
        </Link>
      </div>

      {view.isOwner && (
        <div className="mb-6 flex flex-col gap-4">
          <InviteLinkBox projectId={view.project.id} initialToken={view.project.inviteToken} />

          <div className="rounded-lg bg-card p-4 ring-1 ring-foreground/10">
            <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Membri ({view.members.length})
            </p>
            {view.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Încă niciun invitat — trimite linkul de mai sus.
              </p>
            ) : (
              <ul className="flex list-none flex-col gap-2 p-0">
                {view.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between">
                    <Link href={`/profile/${m.userId}`} className="text-sm text-foreground hover:underline">
                      {m.name ?? "Anonim"}
                    </Link>
                    <RemoveMemberButton projectId={view.project.id} targetUserId={m.userId} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DeleteProjectButton projectId={view.project.id} />
        </div>
      )}

      {(!details || details.length === 0) ? (
        <p className="rounded-[10px] border border-border bg-muted/50 px-3.5 py-2.5 text-sm text-muted-foreground">
          Niciun detaliu încă în acest proiect.
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {details.map((d) => (
            <li key={d.id}>
              <Link
                href={`/details/${d.id}`}
                className="flex items-center gap-3.5 rounded-lg bg-card p-3.5 no-underline ring-1 ring-foreground/10 hover:ring-primary/40"
              >
                {d.imageUrl && (
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-secondary">
                    <Image src={d.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                  </div>
                )}
                <span className="font-semibold text-foreground">{d.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
