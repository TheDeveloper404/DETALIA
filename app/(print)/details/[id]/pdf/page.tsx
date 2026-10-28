import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getDetail } from "@/server/services/detailService";
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";
import { REMOVED_AUTHOR_LABEL } from "@/server/domain/sketch";
import { PrintButton } from "./print-button";
import "./print.css";

export const metadata: Metadata = { title: "Export PDF", robots: { index: false, follow: false } };

export default async function DetailPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const detail = await getDetail(id, session.user.id);
  if (!detail) notFound();
  return (
    <main className="detail-print mx-auto w-full max-w-4xl p-6 sm:p-10">
      <div className="print-controls mb-6 flex flex-wrap items-center gap-3">
        <Link
          href={"/details/" + detail.id}
          className="min-h-11 rounded-lg border border-border px-4 py-3 text-sm hover:bg-secondary"
        >
          Înapoi la detaliu
        </Link>
        <PrintButton />
        <p className="w-full text-sm text-muted-foreground">
          În fereastra de tipărire alege „Save as PDF” / „Salvează ca PDF”. Exportul include
          detaliul de bază și resursele, fără discuții sau schițe.
        </p>
      </div>
      <article className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-primary">DETALIA</p>
        <h1 className="text-3xl font-bold">{detail.title}</h1>
        <p>
          {detail.authorRemovedFromProject ? REMOVED_AUTHOR_LABEL : (detail.authorName ?? "Anonim")}{" "}
          ·{" "}
          {detail.authorSubRole ??
            ROLE_MAIN_LABELS[detail.authorRoleMain as RoleMain] ??
            "Rol nedeclarat"}
          {detail.authorVerification === "VERIFIED" ? " · Verificat" : ""}
        </p>
        <p className="text-sm">{detail.categories.map((c) => c.name).join(" · ")}</p>
        {detail.description && <p className="whitespace-pre-wrap">{detail.description}</p>}
        {detail.imageUrl /* eslint-disable-next-line @next/next/no-img-element -- full-size printable original */ && (
          <img
            src={detail.imageUrl}
            alt={detail.title}
            className="max-h-[220mm] w-full object-contain"
          />
        )}
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
                    <a href={r.url} rel="noreferrer">
                      {r.url}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="break-all border-t border-border pt-3 text-sm">
          Detaliu: /details/{detail.id}
        </p>
      </article>
    </main>
  );
}
