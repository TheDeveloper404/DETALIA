import { Compass, FileText, ImageIcon, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";

import { RolePill } from "@/components/role-pill";
import { auth } from "@/lib/auth";
import { MAX_ANNOTATIONS_PER_DETAIL, type Stroke } from "@/server/domain/sketch";
import { getComments } from "@/server/services/commentService";
import {
  getDeletionPreview,
  getDetail,
  getRelatedDetails,
  isDetailSaved,
  recordDetailView,
} from "@/server/services/detailService";
import { getUserRole } from "@/server/services/roleService";
import { getAnnotations, getTeanc } from "@/server/services/sketchService";
import { getSupplierOffers, isOfferingSupplier } from "@/server/services/supplierOfferService";
import { getTargetValidationViews, getTargetValidationView } from "@/server/services/validationService";

import { DetailWorkspace, type WorkspaceSketch } from "./detail-workspace";
import { ResourceImage } from "./resource-image";

type SketchRow = {
  id: string;
  authorId: string;
  strokesJson: unknown;
  note: string | null;
  createdAt: Date;
  authorName: string | null;
  authorImage: string | null;
  authorRoleMain: string | null;
  authorSubRole: string | null;
  authorVerification: string | null;
  baseSketchIds: unknown;
  authorRemoved: boolean;
  lockedAt: Date | null;
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
    note: r.note,
    validation,
    createdAt: r.createdAt,
    // Rețeta stack-ului: foile peste care s-a desenat, de jos în sus. Goală = schiță pornită de pe
    // detaliul gol (inclusiv toate schițele de dinaintea feature-ului).
    baseSketchIds: (r.baseSketchIds as string[] | null) ?? [],
    authorRemoved: r.authorRemoved,
    lockedAt: r.lockedAt,
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
export default async function DetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ annotation?: string; "sketch-delete"?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  // Semnale despre adnotare, aduse din acțiuni care s-au terminat cu redirect aici (nu pot returna o
  // stare de formular): `failed` = publicarea a reușit dar adnotarea nu (`createDetailAction`);
  // `limit` = s-a apăsat „adnotează" cu plafonul deja atins, dintr-o filă cu stare veche
  // (`startSketchAction`). Fără ele, ambele situații sunt tăcute și userul nu are cum să le înțeleagă.
  const query = await searchParams;
  const annotationNotice = query.annotation;
  const sketchDeleteNotice = query["sketch-delete"];
  const detail = await getDetail(id);
  if (!detail) {
    notFound();
  }

  // Contorul de vizualizări: DUPĂ răspuns (`after`), ca un write de statistică să nu întârzie
  // randarea paginii. Dedup pe user+detaliu într-o fereastră scurtă — vezi recordDetailView.
  after(() => recordDetailView(detail.id, session.user.id));

  const userId = session.user.id;
  const validation = await getTargetValidationView("DETAIL", detail.id, userId);
  const comments = await getComments("DETAIL", detail.id, userId);

  // Schițele publicate (teancul), fiecare cu validarea ei per-țintă (per-SKETCH RĂMÂNE). Dezbaterea NU mai
  // e per-schiță → nu mai fetchăm comentarii pe SKETCH (câștig de perf: elimină N query-uri).
  // Adnotarea autorului (schița lui pe propriul detaliu) NU e în teanc — se randează peste imaginea de
  // bază, ca notă a autorului, nu ca propunere a altcuiva. Citire independentă → paralelă cu teancul.
  const [teancRows, annotationRows] = await Promise.all([getTeanc(detail.id), getAnnotations(detail.id)]);
  // Fără stroke-uri nu e nimic de suprapus → o adnotare goală se elimină (nu arătăm un buton inert).
  const annotations = annotationRows
    .map((row) => ({
      id: row.id,
      strokes: (row.strokesJson as Stroke[] | null) ?? [],
      note: row.note,
    }))
    .filter((a) => a.strokes.length > 0);
  const sketchValidations = await getTargetValidationViews(
    "SKETCH",
    teancRows.map((r) => r.id),
    userId,
  );
  const emptyValidationView = { positions: [], counts: { approve: 0, disapprove: 0 }, myPosition: null };
  const sketches = teancRows.map((r) =>
    toWorkspaceSketch(r, sketchValidations.get(r.id) ?? emptyValidationView),
  );
  const related = await getRelatedDetails(
    detail.id,
    detail.categories.map((c) => c.id),
    5,
  );

  const isAuthor = detail.authorId === userId;
  // Ce va face butonul „Șterge" pe acest detaliu — calculat pe server, doar pentru autor (altcineva
  // nici nu vede butonul). Fără el, dialogul ar promite „se șterge definitiv" și pentru un detaliu care
  // de fapt doar se anonimizează.
  const deletionPreview = isAuthor ? await getDeletionPreview({ detailId: detail.id, userId }) : null;
  // 4 citiri independente (doar userId/detail.id) — paralelizate, nu secvențiale (eficiență găsită la
  // code-review 2026-07-16: doar ultimele 2 erau în Promise.all, restul adăugau latență evitabilă).
  const [saved, role, supplierOffers, offeringSupplier] = await Promise.all([
    isDetailSaved(userId, detail.id),
    getUserRole(userId),
    getSupplierOffers(detail.id),
    isOfferingSupplier(userId, detail.id),
  ]);
  const isFurnizor = role?.roleMain === "FURNIZOR";

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

      {(annotationNotice === "failed" || annotationNotice === "limit") && (
        <div className="mb-5 rounded-xl border border-[#e3c9b4] bg-[#fdf4ec] px-5 py-4">
          <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wide text-[#95492e]">
            {annotationNotice === "failed" ? "Adnotarea nu s-a salvat" : "Ai atins numărul maxim de adnotări"}
          </div>
          <p className="text-[14.5px] leading-relaxed text-foreground">
            {annotationNotice === "failed"
              ? "Detaliul e publicat, dar desenul tău peste imagine nu a apucat să fie salvat. Îl poți face din nou cu butonul de adnotare de sub imagine."
              : `Un detaliu poate avea cel mult ${MAX_ANNOTATIONS_PER_DETAIL} adnotări. Deschide una dintre cele existente și șterge-o dacă vrei să adaugi alta.`}
          </p>
        </div>
      )}

      {/* Ștergere refuzată: foaia intrase într-o dezbatere între încărcarea paginii și click (tab vechi).
          Fără mesaj, pagina se reîncarcă neschimbată și pare o eroare tăcută. */}
      {sketchDeleteNotice === "locked" && (
        <div className="mb-5 rounded-xl border border-[#e3c9b4] bg-[#fdf4ec] px-5 py-4">
          <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wide text-[#95492e]">
            Schița nu mai poate fi ștearsă
          </div>
          <p className="text-[14.5px] leading-relaxed text-foreground">
            Altcineva a desenat deja peste ea, iar desenul lui s-ar rupe dacă foaia ar dispărea. Autorul
            ei își poate retrage doar numele, din meniul schiței.
          </p>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-7">
          {/* ===== RESURSE (opționale) — imaginea 2D trăiește acum în viewportul workspace-ului (tab 0) ===== */}
          {detail.resources.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="mr-0.5 font-mono text-[11px] uppercase tracking-wider text-[#a59a88]">
                Resurse
              </span>
              {detail.resources.map((r) => {
                // IMAGE: thumbnail + lightbox (imaginea propriu-zisă), NU chip cu link ca restul tipurilor.
                if (r.type === "IMAGE" && r.url) {
                  return <ResourceImage key={r.id} url={r.url} alt={detail.title} />;
                }
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
              location: detail.location,
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
            deletionMode={deletionPreview?.mode}
            annotations={annotations}
            sketches={sketches}
            comments={comments}
            currentUserId={session.user.id}
            currentUserName={session.user.name}
            currentUserImage={session.user.image}
            isCurrentUserFurnizor={isFurnizor}
            isOfferingSupplier={offeringSupplier}
            supplierOffers={supplierOffers}
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
