import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { DETAIL_STATUS } from "@/server/domain/detail";
import { listCategories } from "@/server/services/categoryService";
import { getDetail, getDetailForEditing } from "@/server/services/detailService";

import { DetailForm, type DetailFormInitial } from "../../new/detail-form";
import { publishDraftDetailAction, saveDraftDetailAction, updateDetailAction } from "./actions";

// Tipurile de resursă editabile din formular (TEXT nu are câmp în formular → nu se editează aici).
const EDITABLE_RESOURCE_TYPES = new Set(["IMAGE", "LINK", "PDF", "CAD"]);

// Editarea unui detaliu — DOAR autorul lui. Non-autorul e trimis la pagina detaliului (o poate vedea).
export default async function EditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  // Ownership scoped ÎN query (draft SAU published, doar owner) — un DRAFT al altui user nu ajunge
  // nici măcar ca „not found după citire" (la fel ca la Planșă, strict privată cât e ciornă).
  const detail = await getDetailForEditing(id, session.user.id);
  if (!detail) {
    // Non-autor pe un detaliu PUBLICAT (existența e deja publică, în feed) → redirect spre pagina
    // de vizualizare, nu 404 (comportamentul de dinainte). Un DRAFT al altui user tot dă notFound —
    // getDetail e PUBLISHED-only, deci nu-l „vede" aici, păstrând privacy-ul strict al ciornelor.
    const publicDetail = await getDetail(id);
    if (publicDetail) redirect(`/details/${id}`);
    notFound();
  }
  const isDraft = detail.status === DETAIL_STATUS.DRAFT;

  const categories = await listCategories();

  const initial: DetailFormInitial = {
    detailId: detail.id,
    title: detail.title,
    description: detail.description,
    categoryIds: detail.categories.map((c) => c.id),
    imageUrl: detail.imageUrl,
    climateZone: detail.climateZone,
    seismicAg: detail.seismicAg,
    seismicTc: detail.seismicTc,
    snowLoad: detail.snowLoad,
    windLoad: detail.windLoad,
    resources: detail.resources
      .filter((r) => EDITABLE_RESOURCE_TYPES.has(r.type) && !!r.url)
      .map((r) => ({ type: r.type as "IMAGE" | "LINK" | "PDF" | "CAD", value: r.url as string })),
  };

  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] flex-1 px-6 pb-20 pt-8">
      {/* breadcrumb — pt ciornă, titlul nu e link (pagina publică /details/[id] nu există încă). */}
      <nav className="mb-[18px] flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Link href="/feed" className="hover:text-foreground">
          Detalii
        </Link>
        <span className="text-[#cabfac]">/</span>
        {isDraft ? (
          <Link href="/sketches/drafts" className="hover:text-foreground">
            Ciornele mele
          </Link>
        ) : (
          <Link href={`/details/${detail.id}`} className="max-w-[32ch] truncate hover:text-foreground">
            {detail.title}
          </Link>
        )}
        <span className="text-[#cabfac]">/</span>
        <span className="text-foreground/70">{isDraft ? "Continuă ciorna" : "Editează"}</span>
      </nav>

      <h1 className="mb-2 text-center font-heading text-[30px] font-extrabold tracking-tight">
        {isDraft ? "Continuă ciorna" : "Editează detaliul"}
      </h1>
      <p className="mb-7 mx-auto max-w-[58ch] text-center text-[15px] leading-relaxed text-muted-foreground">
        {isDraft
          ? "Completează ce lipsește și publică, sau salvează ciorna din nou pentru mai târziu."
          : "Actualizează textul, contextul tehnic, categoriile sau imaginea. Modificările apar imediat."}
      </p>

      <DetailForm
        categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, isGroup: c.isGroup }))}
        action={isDraft ? publishDraftDetailAction : updateDetailAction}
        saveDraftAction={isDraft ? saveDraftDetailAction : undefined}
        initial={initial}
        submitLabel={isDraft ? "Publică detaliul" : "Salvează modificările"}
      />
    </main>
  );
}
