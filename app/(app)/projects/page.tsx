import { Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listProjectsForUser } from "@/server/services/projectService";

import { CreateProjectForm } from "./create-project-form";

// „Proiectele mele" — colaborare restrânsă (owner SAU membru activ). Listă simplă, ca /canvases.
export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const projects = await listProjectsForUser(userId);

  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] flex-1 px-6 pb-20 pt-8">
      <div className="mb-6 flex items-center gap-2.5">
        <Users className="size-5 text-primary" strokeWidth={2} />
        <h1 className="font-heading text-[26px] font-extrabold tracking-tight">Proiectele mele</h1>
      </div>
      <p className="mb-6 max-w-[58ch] text-[15px] leading-relaxed text-muted-foreground">
        Un spațiu de colaborare restrânsă — inviți oameni printr-un link și lucrați la detalii înainte
        de a le scoate, opțional, în comunitate.
      </p>

      <CreateProjectForm />

      {projects.length === 0 ? (
        <p className="mt-6 rounded-[10px] border border-border bg-muted/50 px-3.5 py-2.5 text-sm text-muted-foreground">
          Nu ești încă în niciun proiect.
        </p>
      ) : (
        <>
          <ProjectSection
            title="Proiectele mele"
            projects={projects.filter((p) => p.ownerId === userId)}
          />
          <ProjectSection
            title="Proiecte în care sunt membru"
            projects={projects.filter((p) => p.ownerId !== userId)}
          />
        </>
      )}
    </main>
  );
}

function ProjectSection({
  title,
  projects,
}: {
  title: string;
  projects: { id: string; name: string }[];
}) {
  if (projects.length === 0) return null;
  return (
    <div className="mt-6 first:mt-0">
      <h2 className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h2>
      <ul className="flex list-none flex-col gap-3 p-0">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              href={`/projects/${p.id}`}
              className="flex items-center justify-between rounded-lg bg-card px-4 py-3.5 no-underline ring-1 ring-foreground/10 hover:ring-primary/40"
            >
              <span className="font-semibold text-foreground">{p.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
