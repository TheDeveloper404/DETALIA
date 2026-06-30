import { Activity, FileText, ImageIcon, Link as LinkIcon, Snowflake } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AvatarInitials } from "@/components/avatar-initials";
import { RolePill } from "@/components/role-pill";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Stroke } from "@/server/domain/sketch";
import { getComments } from "@/server/services/commentService";
import { getDetail, getRelatedDetails } from "@/server/services/detailService";
import { getTeanc } from "@/server/services/sketchService";
import { getTargetValidationView } from "@/server/services/validationService";

import { CommentsSection } from "./comments-section";
import { DeleteDetailButton } from "./delete-detail-button";
import { SketchSection, type SketchItem } from "./sketch-section";
import { ValidationPanel } from "./validation-panel";

type SketchRow = {
  id: string;
  authorId: string;
  strokesJson: unknown;
  authorName: string | null;
  authorImage: string | null;
  authorRoleMain: string | null;
  authorSubRole: string | null;
  authorVerification: string | null;
};

// Mapează un rând de schiță (cu strokesJson jsonb) la forma serializabilă pt client.
function toSketchItem(r: SketchRow): SketchItem {
  return {
    id: r.id,
    authorId: r.authorId,
    authorName: r.authorName,
    authorImage: r.authorImage,
    authorRoleMain: r.authorRoleMain,
    authorSubRole: r.authorSubRole,
    authorVerification: r.authorVerification,
    strokes: (r.strokesJson as Stroke[] | null) ?? [],
  };
}

// Iconița per tip de resursă (vizual, fără semnificație de business).
const RESOURCE_ICON = {
  IMAGE: ImageIcon,
  PDF: FileText,
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
  const related = await getRelatedDetails(detail.id, detail.categoryId, 5);

  const verified = detail.authorVerification === "VERIFIED";
  const isAuthor = detail.authorId === userId;

  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] flex-1 px-6 pb-20 pt-5">
      {/* breadcrumb */}
      <nav className="mb-5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Link href="/feed" className="hover:text-foreground">
          Detalii
        </Link>
        {detail.categoryName && (
          <>
            <span className="text-[#cabfac]">/</span>
            <Link
              href={`/feed?cat=${detail.categoryId}`}
              className="hover:text-foreground"
            >
              {detail.categoryName}
            </Link>
          </>
        )}
        <span className="text-[#cabfac]">/</span>
        <span className="truncate text-foreground/70">{detail.title}</span>
      </nav>

      <div className="flex min-w-0 flex-col gap-7">
          {/* ===== ANTET DETALIU ===== */}
          <div>
            <h1 className="mb-4 font-heading text-[32px] font-extrabold leading-[1.14] tracking-tight text-balance">
              {detail.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <AvatarInitials name={detail.authorName} imageUrl={detail.authorImage} size={38} />
              <span className="font-heading text-[15.5px] font-bold">
                {detail.authorName ?? "Anonim"}
              </span>
              <RolePill roleMain={detail.authorRoleMain} verified={verified} />
              {detail.categoryName && (
                <Link
                  href={`/feed?cat=${detail.categoryId}`}
                  className="rounded-md border border-[#ecdcc8] bg-[#f6ede4] px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-primary"
                >
                  {detail.categoryName}
                </Link>
              )}
              <span className="font-mono text-xs text-muted-foreground">
                · publicat {formatDate(detail.createdAt)}
              </span>
              {detail.authorId === userId && (
                <span className="ml-auto">
                  <DeleteDetailButton detailId={detail.id} />
                </span>
              )}
            </div>

            {/* zone climatice / seismice */}
            {(detail.climateZone || detail.seismicZone) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {detail.climateZone && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                    <Snowflake className="size-3 text-[#5e6f8a]" strokeWidth={2} />
                    Zonă climatică {detail.climateZone}
                  </span>
                )}
                {detail.seismicZone && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                    <Activity className="size-3 text-primary" strokeWidth={2} />
                    Zonă seismică {detail.seismicZone}
                  </span>
                )}
              </div>
            )}

            {detail.description && (
              <div className="mt-4 whitespace-pre-wrap text-[15.5px] leading-relaxed text-foreground/80 text-pretty">
                {detail.description}
              </div>
            )}
          </div>

          {/* ===== IMAGINEA 2D ===== */}
          <figure className="m-0">
            <div className="relative overflow-hidden rounded-2xl border border-[#e6ddcf] bg-[#faf7f1]">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "linear-gradient(#ece1cd 1px,transparent 1px),linear-gradient(90deg,#ece1cd 1px,transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
              <div className="relative z-[1] flex items-center justify-center p-6">
                <div className="relative aspect-[4/3] w-full max-w-2xl">
                  <Image
                    src={detail.imageUrl}
                    alt={detail.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            </div>

            {/* resurse (opționale) */}
            {detail.resources.length > 0 && (
              <figcaption className="mt-3.5 flex flex-wrap items-center gap-2.5">
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
              </figcaption>
            )}
          </figure>

          {/* ===== VALIDARE PE ROLURI ===== */}
          <ValidationPanel
            targetType="DETAIL"
            targetId={detail.id}
            detailId={detail.id}
            allowSketch
            canValidate={!isAuthor}
            counts={validation.counts}
            myPosition={validation.myPosition}
            positions={validation.positions}
            meta={{ comments: comments.length, sketches: published.length }}
          />

          {/* ===== TEANCUL DE SCHIȚE ===== */}
          <SketchSection
            detailId={detail.id}
            imageUrl={detail.imageUrl}
            published={published}
            isDetailAuthor={isAuthor}
            currentUserId={session.user.id}
            currentUserName={session.user.name}
            currentUserImage={session.user.image}
          />

          {/* ===== DEZBATERE (DETALIU) ===== */}
          <CommentsSection
            targetType="DETAIL"
            targetId={detail.id}
            detailId={detail.id}
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
