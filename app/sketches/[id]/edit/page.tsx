import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getDetail } from "@/server/services/detailService";
import { getDraftForEdit } from "@/server/services/sketchService";

import { SketchEditor } from "./sketch-editor";

// Editor de schiță — accesibil DOAR cu un draft existent (creat din fereastra de Dezaprob).
// getDraftForEdit garantează: doar autorul, doar cât e DRAFT.
export default async function SketchEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const draft = await getDraftForEdit(id, session.user.id);
  if (!draft.ok) {
    notFound();
  }

  const detail = await getDetail(draft.value.detailId);
  if (!detail) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <Link
        href={`/details/${detail.id}`}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Înapoi la detaliu
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Schițează peste „{detail.title}”</h1>
        <p className="text-sm text-muted-foreground">
          Desenează cum ar trebui să arate. Când trimiți, autorul detaliului acceptă sau respinge propunerea.
        </p>
      </header>

      <SketchEditor
        sketchId={id}
        detailId={detail.id}
        imageUrl={detail.imageUrl}
        initialStrokes={draft.value.strokes}
      />
    </main>
  );
}
