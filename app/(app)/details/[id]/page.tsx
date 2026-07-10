import { Compass, FileText, ImageIcon, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RolePill } from "@/components/role-pill";
import { auth } from "@/lib/auth";
import type { Stroke } from "@/server/domain/sketch";
import { getComments } from "@/server/services/commentService";
import { getDetail, getRelatedDetails, isDetailSaved } from "@/server/services/detailService";
import { getTeanc } from "@/server/services/sketchService";
import { getTargetValidationView } from "@/server/services/validationService";

import { DetailWorkspace, type WorkspaceSketch } from "./detail-workspace";

type SketchRow = {
  id: string;
  authorId: string;
  strokesJson: unknown;
  createdAt: Date;
  authorName: string | null;
  authorImage: string | null;
  authorRoleMain: string | null;
  authorSubRole: string | null;
  authorVerification: string | null;
};

// Mapează un rând de schiță (cu strokesJson jsonb) la forma serializabilă pt workspace (autor + stroke-uri).
function toWorkspaceSketch(r: SketchRow, validation: WorkspaceSketch["validation"]): WorkspaceSketch {
  return {
    id: r.id,
    author: {
      id: r.authorId,
      name: r.authorName,
      image: r.authorImage,
      roleMain: r.authorRoleMain,
      subRole: r.authorSubRole,
      verification: r.authorVerification,
    },
    strokes: (r.strokesJson as Stroke[] | null) ?? [],
    validation,
    createdAt: r.createdAt,
  };
}

// Iconița per tip de resursă (vizual, fără semnificație de business).
const RESOURCE_ICON = {
  IMAGE: ImageIcon,
  PDF: FileText,
  CAD: Compass,
  LINK: LinkIcon,
  TEXT: FileText,
} as const;

// Pagina unui detaliu (the «repo»): antet (autor+rol), imaginea 2D, validarea pe roluri,
// teancul de schițe și dezbaterea — o singură coloană lățită. Jos, full-width: detalii înrudite.
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
  const comments = await getComments("DETAIL", detail.id, userId);

  // Schițele publicate (teancul), fiecare cu validarea ei per-țintă (per-SKETCH RĂMÂNE). Dezbaterea NU mai
  // e per-schiță → nu mai fetchăm comentarii pe SKETCH (câștig de perf: elimină N query-uri).
  const teancRows = await getTeanc(detail.id);
  const sketches = await Promise.all(
    teancRows.map(async (r) =>
      toWorkspaceSketch(r, await getTargetValidationView("SKETCH", r.id, userId)),
    ),
  );
  const related = await getRelatedDetails(
    detail.id,
    detail.categories.map((c) => c.id),
    5,
  );

  const isAuthor = detail.authorId === userId;
  const saved = await isDetailSaved(userId, detail.id);

  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] flex-1 px-6 pb-20 pt-5">
      {/* breadcrumb */}
      <nav className="mb-5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Link href="/feed" className="hover:text-foreground">
          Detalii
        </Link>
        {detail.categories[0] && (
          <>
            <span className="text-[#cabfac]">/</span>
            <Link href={`/feed?cat=${detail.categories[0].id}`} className="hover:text-foreground">
              {detail.categories[0].name}
            </Link>
          </>
        )}
        <span className="text-[#cabfac]">/</span>
        <span className="truncate text-foreground/70">{detail.title}</span>
      </nav>

      <div className="flex min-w-0 flex-col gap-7">
          {/* ===== RESURSE (opționale) — imaginea 2D trăiește acum în viewportul workspace-ului (tab 0) ===== */}
          {detail.resources.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="mr-0.5 font-mono text-[11px] uppercase tracking-wider text-[#a59a88]">
                Resurse
              </span>
              {detail.resources.map((r) => {
                const Icon = RESOURCE_ICON[r.type as keyof typeof RESOURCE_ICON] ?? FileText;
                const label = r.type === "TEXT" ? r.body : (r.url ?? "resursă");
                const chip = (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-foreground/80">
                    <Icon className="size-3.5 text-[#5e6f8a]" strokeWidth={1.8} />
                    <span className="max-w-[28ch] truncate">{label}</span>
                  </span>
                );
                return r.type === "TEXT" || !r.url ? (
                  <span key={r.id}>{chip}</span>
                ) : (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:[&>span]:border-primary"
                  >
                    {chip}
                  </a>
                );
              })}
            </div>
          )}

          {/* ===== WORKSPACE UNIFICAT (taburi: detaliu de bază + schițe) + dezbatere unificată ===== */}
          <DetailWorkspace
            detailId={detail.id}
            // Pagina publică arată DOAR detalii PUBLISHED (getDetail) → imageUrl mereu setat.
            imageUrl={detail.imageUrl!}
            header={{
              title: detail.title,
              description: detail.description,
              createdAt: detail.createdAt,
              categories: detail.categories,
              climateZone: detail.climateZone,
              seismicAg: detail.seismicAg,
              seismicTc: detail.seismicTc,
              snowLoad: detail.snowLoad,
              windLoad: detail.windLoad,
              isSaved: saved,
            }}
            detailAuthor={{
              id: detail.authorId,
              name: detail.authorName,
              image: detail.authorImage,
              roleMain: detail.authorRoleMain,
              subRole: detail.authorSubRole,
              verification: detail.authorVerification,
            }}
            detailValidation={validation}
            isDetailAuthor={isAuthor}
            sketches={sketches}
            comments={comments}
            currentUserId={session.user.id}
            currentUserName={session.user.name}
            currentUserImage={session.user.image}
          />
      </div>

      {/* ===================== DETALII ÎNRUDITE (full-width) ===================== */}
      {related.length > 0 && (
        <section className="mt-12 border-t border-[#e6ddcf] pt-8">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Detalii înrudite
          </div>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <Link href={`/details/${r.id}`} className="group block">
                  <span className="block font-heading text-[14px] font-semibold leading-snug text-foreground/90 group-hover:text-primary">
                    {r.title}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {r.authorName && (
                      <span className="text-[12px] text-muted-foreground">{r.authorName}</span>
                    )}
                    <RolePill
                      roleMain={r.authorRoleMain}
                      subRole={r.authorSubRole}
                      verified={r.authorVerification === "VERIFIED"}
                    />
                    <span className="font-mono text-[11px] text-[#a59a88]">
                      {r.commentCount} com · {r.sketchCount} schițe
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
