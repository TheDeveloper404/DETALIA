import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { blobReadUrl } from "@/lib/blob-read-url";
import { siteUrl } from "@/lib/site-url";
import { REMOVED_AUTHOR_LABEL } from "@/server/domain/sketch";
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";
import type { getDetail } from "@/server/services/detailService";
import type { getPrintStack } from "@/server/services/sketchService";
import { SketchPrintContent } from "../sketch/[sketchId]/pdf/sketch-print-content";

export function StackPrintDocument({ detail, stack, children }: {
  detail: NonNullable<Awaited<ReturnType<typeof getDetail>>>;
  stack: NonNullable<Awaited<ReturnType<typeof getPrintStack>>>;
  children?: ReactNode;
}) {
  const detailAuthor = detail.authorRemovedFromProject || detail.isAnonymized ? REMOVED_AUTHOR_LABEL : (detail.authorName ?? "Anonim");
  const sheets = stack.layers.map(({ id, source, layer }) => ({
    id, source, note: layer.note,
    authorId: source === "annotation" ? detail.authorId : layer.authorId,
    authorName: source === "annotation" ? detailAuthor : layer.authorRemoved ? REMOVED_AUTHOR_LABEL : (layer.authorName ?? "Anonim"),
  }));
  const authors = [...new Map(sheets.map((sheet) => [sheet.authorId || sheet.id, sheet.authorName])).values()];
  const backHref = `/details/${detail.id}${stack.activeSketch ? `?sketch=${stack.activeSketch.id}` : ""}`;
  return (
    <main className="detail-print mx-auto w-full max-w-4xl p-6 sm:p-10">
      <SketchPrintContent backHref={backHref} backLabel={stack.activeSketch ? "Înapoi la schiță" : "Înapoi la detaliu"}
        thumbnailUrl={null} imageUrl={detail.imageUrl ? blobReadUrl(detail.imageUrl, "detail", detail.id) : null}
        alt={stack.activeSketch ? `Schiță peste „${detail.title}”` : detail.title} strokes={stack.printStrokes} veil={stack.layers.length > 0}
        footer={<>
          {sheets.length > 0 && <section className="print-notes flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Descrierile schițelor din teanc</h2>
            {sheets.map((sheet, index) => <div key={sheet.id} className="flex flex-col gap-1">
              <h3 className="break-after-avoid font-semibold">{sheet.source === "annotation" ? "Adnotarea autorului" : `Schița ${index + 1}`} · {sheet.authorName}</h3>
              <p className="whitespace-pre-wrap break-words">{sheet.note || "Fără descriere."}</p>
            </div>)}
          </section>}
          {children}
          <p className="border-t border-border pt-3 text-sm"><a href={siteUrl() + backHref}>Vezi detaliul pe DETALIA</a></p>
        </>}
      >
        <header className="print-brand flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <BrandLogo size={32} href={siteUrl()} />
          <p className="text-sm text-muted-foreground">Detaliile bune se construiesc impreuna</p>
        </header>
        <h1 className="break-words text-2xl font-bold leading-tight">{stack.activeSketch ? `Schiță peste „${detail.title}”` : detail.title}</h1>
        <p className="text-sm"><strong>Autor detaliu:</strong> {detailAuthor} · {detail.authorSubRole ?? ROLE_MAIN_LABELS[detail.authorRoleMain as RoleMain] ?? "Rol nedeclarat"}</p>
        {authors.length > 0 && <section aria-label="Autori schițe din teanc">
          <h2 className="mb-1 text-sm font-semibold">Autori schițe din teanc</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{authors.map((name, index) => <li key={index} className="min-w-0 max-w-full break-words">{name}</li>)}</ul>
        </section>}
      </SketchPrintContent>
    </main>
  );
}
