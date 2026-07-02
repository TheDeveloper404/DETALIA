import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listCategories } from "@/server/services/categoryService";
import { getDetail } from "@/server/services/detailService";

import { DetailForm, type DetailFormInitial } from "../../new/detail-form";
import { updateDetailAction } from "./actions";

// Tipurile de resursă editabile din formular (TEXT nu are câmp în formular → nu se editează aici).
const EDITABLE_RESOURCE_TYPES = new Set(["IMAGE", "LINK", "PDF"]);

// Editarea unui detaliu — DOAR autorul lui. Non-autorul e trimis la pagina detaliului (o poate vedea).
export default async function EditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const detail = await getDetail(id);
  if (!detail) {
    notFound();
  }
  // Ownership pe server (sursa de adevăr; UI-ul nu decide). Non-autor → înapoi la detaliu.
  if (detail.authorId !== session.user.id) {
    redirect(`/details/${detail.id}`);
  }

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
      .map((r) => ({ type: r.type as "IMAGE" | "LINK" | "PDF", value: r.url as string })),
  };

  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] flex-1 px-6 pb-20 pt-8">
      {/* breadcrumb */}
      <nav className="mb-[18px] flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Link href="/feed" className="hover:text-foreground">
          Detalii
        </Link>
        <span className="text-[#cabfac]">/</span>
        <Link href={`/details/${detail.id}`} className="max-w-[32ch] truncate hover:text-foreground">
          {detail.title}
        </Link>
        <span className="text-[#cabfac]">/</span>
        <span className="text-foreground/70">Editează</span>
      </nav>

      <h1 className="mb-2 text-center font-heading text-[30px] font-extrabold tracking-tight">
        Editează detaliul
      </h1>
      <p className="mb-7 mx-auto max-w-[58ch] text-center text-[15px] leading-relaxed text-muted-foreground">
        Actualizează textul, contextul tehnic, categoriile sau imaginea. Modificările apar imediat.
      </p>

      <DetailForm
        categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))}
        action={updateDetailAction}
        initial={initial}
        submitLabel="Salvează modificările"
      />
    </main>
  );
}
