import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { blobReadUrl } from "@/lib/blob-read-url";
import { siteUrl } from "@/lib/site-url";
import { getDetail } from "@/server/services/detailService";
import { getTeancSketch } from "@/server/services/sketchService";
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";
import { REMOVED_AUTHOR_LABEL } from "@/server/domain/sketch";
import { SketchPrintContent } from "./sketch-print-content";
import "../../../pdf/print.css";

export const metadata: Metadata = { title: "Export PDF", robots: { index: false, follow: false } };

export default async function SketchPdfPage({
  params,
}: {
  params: Promise<{ id: string; sketchId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, sketchId } = await params;
  const detail = await getDetail(id, session.user.id);
  if (!detail) notFound();
  const sketch = await getTeancSketch(detail.id, sketchId);
  if (!sketch) notFound();
  const sketchHref = "/details/" + detail.id + "?sketch=" + sketch.id;
  return (
    <main className="detail-print mx-auto w-full max-w-4xl p-6 sm:p-10">
      <SketchPrintContent
        backHref={sketchHref}
        thumbnailUrl={sketch.thumbnailUrl ? blobReadUrl(sketch.thumbnailUrl, "sketch", sketch.id) : null}
        imageUrl={detail.imageUrl ? blobReadUrl(detail.imageUrl, "detail", detail.id) : null}
        alt={"Schiță peste „" + detail.title + "”"}
        strokes={sketch.printStrokes}
        footer={<p className="break-all border-t border-border pt-3 text-sm">Schiță: {siteUrl()}{sketchHref}</p>}
      >
        <p className="text-sm font-semibold text-primary">DETALIA</p>
        <h1 className="text-3xl font-bold">Schiță peste „{detail.title}”</h1>
        <p>
          {sketch.authorRemoved ? REMOVED_AUTHOR_LABEL : (sketch.authorName ?? "Anonim")} ·{" "}
          {sketch.authorSubRole ??
            ROLE_MAIN_LABELS[sketch.authorRoleMain as RoleMain] ??
            "Rol nedeclarat"}
          {sketch.authorVerification === "VERIFIED" ? " · Verificat" : ""}
        </p>
        {sketch.note && <p className="whitespace-pre-wrap">{sketch.note}</p>}
      </SketchPrintContent>
    </main>
  );
}
