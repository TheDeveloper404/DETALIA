import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { blobReadUrl } from "@/lib/blob-read-url";
import { siteUrl } from "@/lib/site-url";
import { getDetail } from "@/server/services/detailService";
import { getPrintStack } from "@/server/services/sketchService";
import { StackPrintDocument } from "./stack-print-document";
import "./print.css";

export const metadata: Metadata = { title: "Export PDF", robots: { index: false, follow: false } };

// Un link relativ nu se mai poate deschide din PDF-ul salvat.
function printableUrl(url: string): string {
  return url.startsWith("/") ? siteUrl() + url : url;
}

export default async function DetailPdfPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ stack?: string | string[] }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const detail = await getDetail(id, session.user.id);
  if (!detail) notFound();
  const query = await searchParams;
  const stack = query?.stack === undefined
    ? { activeSketch: null, layers: [], printStrokes: [] }
    : await getPrintStack(detail.id, typeof query.stack === "string" ? query.stack.split(",") : query.stack);
  if (!stack) notFound();
  return (
    <StackPrintDocument detail={detail} stack={stack}>
      {detail.categories.length > 0 && <p className="text-sm">{detail.categories.map((c) => c.name).join(" · ")}</p>}
      {detail.description && <section><h2 className="mb-1 text-lg font-semibold">Descriere detaliu</h2><p className="whitespace-pre-wrap break-words">{detail.description}</p></section>}
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Localitate", detail.location],
            ["Zonă climatică", detail.climateZone],
            ["Accelerație seismică ag", detail.seismicAg],
            ["Perioadă de control Tc", detail.seismicTc],
            ["Încărcare zăpadă", detail.snowLoad],
            ["Încărcare vânt", detail.windLoad],
          ].map(([label, value]) =>
            value ? (
              <div key={label}>
                <dt className="font-semibold">{label}</dt>
                <dd>{value}</dd>
              </div>
            ) : null,
          )}
        </dl>
        {detail.resources.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Resurse</h2>
            <ul className="flex flex-col gap-2">
              {detail.resources.map((r) => (
                <li key={r.id} className="break-words text-sm">
                  {r.body && <p className="whitespace-pre-wrap">{r.body}</p>}
                  {r.url && (
                    <a href={printableUrl(blobReadUrl(r.url, "resource", r.id))} rel="noreferrer">
                      {({ IMAGE: "Imagine", PDF: "PDF", CAD: "CAD", LINK: "Link", TEXT: "Resursă" })[r.type]}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
    </StackPrintDocument>
  );
}
