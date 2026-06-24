import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AuthorBadge } from "@/components/author-badge";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import type { Stroke } from "@/server/domain/sketch";
import { getComments } from "@/server/services/commentService";
import { getDetail } from "@/server/services/detailService";
import { getPendingForOwner, getTeanc } from "@/server/services/sketchService";
import { getTargetValidationView } from "@/server/services/validationService";

import { CommentsSection } from "./comments-section";
import { SketchSection, type SketchItem } from "./sketch-section";
import { ValidationPanel } from "./validation-panel";

type SketchRow = {
  id: string;
  strokesJson: unknown;
  authorName: string | null;
  authorRoleMain: string | null;
  authorSubRole: string | null;
  authorVerification: string | null;
};

// Mapează un rând de schiță (cu strokesJson jsonb) la forma serializabilă pt client.
function toSketchItem(r: SketchRow): SketchItem {
  return {
    id: r.id,
    authorName: r.authorName,
    authorRoleMain: r.authorRoleMain,
    authorSubRole: r.authorSubRole,
    authorVerification: r.authorVerification,
    strokes: (r.strokesJson as Stroke[] | null) ?? [],
  };
}

// Pagina unui detaliu (the «repo»). Imagine + autor/rol + descriere + resurse.
// Panoul de validare (pas 4) și coloana de comentarii (pas 5) se cablează în locurile marcate.
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const detail = await getDetail(id);
  if (!detail) {
    notFound();
  }

  const userId = session.user.id;
  const validation = await getTargetValidationView("DETAIL", detail.id, userId);
  const comments = await getComments("DETAIL", detail.id);

  // Schițele publicate (teancul) + dezbaterea fiecăreia (validare + comentarii pe SKETCH).
  const teancRows = await getTeanc(detail.id);
  const published = await Promise.all(
    teancRows.map(async (r) => ({
      ...toSketchItem(r),
      validation: await getTargetValidationView("SKETCH", r.id, userId),
      comments: await getComments("SKETCH", r.id),
    })),
  );
  const pending = (await getPendingForOwner(detail.id, userId)).map(toSketchItem);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <Link
        href="/feed"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Înapoi la feed
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Coloana principală: detaliul (mama) */}
        <article className="flex flex-col gap-4">
          <header className="flex flex-col items-start gap-2">
            {detail.categoryName && (
              <Badge variant="secondary">{detail.categoryName}</Badge>
            )}
            <h1 className="text-2xl font-semibold tracking-tight">{detail.title}</h1>
            <AuthorBadge
              name={detail.authorName}
              roleMain={detail.authorRoleMain}
              subRole={detail.authorSubRole}
              verified={detail.authorVerification === "VERIFIED"}
            />
          </header>

          {detail.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
              {detail.description}
            </p>
          )}

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
            <Image
              src={detail.imageUrl}
              alt={detail.title}
              fill
              sizes="(max-width: 1024px) 100vw, 66vw"
              className="object-contain"
              priority
            />
          </div>

          {detail.resources.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Resurse</h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                {detail.resources.map((r) =>
                  r.type === "TEXT" ? (
                    <li key={r.id} className="text-foreground/80">
                      {r.body}
                    </li>
                  ) : (
                    <li key={r.id}>
                      <a
                        href={r.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground/80 underline underline-offset-4 hover:text-foreground"
                      >
                        {r.url}
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </section>
          )}
        </article>

        {/* Coloana laterală: validare (pas 4) + comentarii (pas 5) */}
        <aside className="flex flex-col gap-6">
          <ValidationPanel
            targetType="DETAIL"
            targetId={detail.id}
            detailId={detail.id}
            allowSketch
            counts={validation.counts}
            myPosition={validation.myPosition}
            positions={validation.positions}
          />

          <CommentsSection
            targetType="DETAIL"
            targetId={detail.id}
            detailId={detail.id}
            comments={comments}
          />
        </aside>
      </div>

      <SketchSection
        detailId={detail.id}
        imageUrl={detail.imageUrl}
        published={published}
        pending={pending}
      />
    </main>
  );
}
