"use client";

import { LayoutDashboard, Pencil, PencilLine, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useOptimistic } from "react";

import { deleteDetailDraftAction, deleteDraftAction } from "./actions";

// Ciornă unificată — SCHIȚĂ (peste un detaliu existent, PUBLISHED) sau DETALIU nou (fără părinte).
// `id` = sketchId sau detailId, după caz; `detailId` există doar pt schițe (link către editorul lor).
export type UnifiedDraft =
  | { kind: "sketch"; id: string; detailId: string; title: string; imageUrl: string | null; createdAt: Date }
  | { kind: "detail"; id: string; title: string; imageUrl: string | null; createdAt: Date };

function editHref(d: UnifiedDraft): string {
  return d.kind === "sketch" ? `/sketches/${d.id}/edit` : `/details/${d.id}/edit`;
}

// Ștergere OPTIMISTĂ: cardul dispare instant la click, indiferent de tip. Fiecare tip își cheamă
// propriul server action (deleteDraftAction/deleteDetailDraftAction); dacă pică, revalidarea readuce rândul.
// Vizual aliniat cu cardurile din „Detalii salvate"/feed (DetailCard): imagine 4/3 stânga, badge peste
// imagine, conținut la dreapta — aceeași „gramatică" de card, conținut specific ciornelor.
export function DraftsList({ drafts }: { drafts: UnifiedDraft[] }) {
  const [optimisticDrafts, removeDraft] = useOptimistic(drafts, (state, id: string) =>
    state.filter((d) => d.id !== id),
  );

  async function onDelete(d: UnifiedDraft, formData: FormData) {
    removeDraft(d.id);
    if (d.kind === "sketch") await deleteDraftAction(formData);
    else await deleteDetailDraftAction(formData);
  }

  if (optimisticDrafts.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-card px-8 py-16 text-center">
        <div className="mb-[22px] flex size-16 items-center justify-center rounded-lg border border-border bg-secondary">
          <PencilLine className="size-7 text-primary" strokeWidth={1.8} />
        </div>
        <h2 className="mb-2 text-[22px] font-bold">Nicio ciornă salvată</h2>
        <p className="mb-6 max-w-[48ch] leading-relaxed text-muted-foreground">
          O schiță pornește dintr-un detaliu, prin „Dezaprob și fac o schiță”, sau salvezi un detaliu nou
          ca ciornă din formularul de adăugare.
        </p>
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 rounded-lg border border-[#95492e] bg-primary px-[22px] py-3 font-semibold text-primary-foreground no-underline transition-colors hover:bg-[#974a2e]"
        >
          Explorează feed-ul
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {optimisticDrafts.map((d) => {
        const title = d.kind === "sketch" ? `Schiță peste „${d.title}”` : d.title || "Detaliu fără titlu";
        return (
          <article
            key={d.id}
            className="flex flex-col rounded-lg bg-card ring-1 ring-foreground/10 sm:min-h-[160px] sm:flex-row"
          >
            {/* Imaginea (sau fallback-ul de tip) — aceeași zonă 4/3 ca la DetailCard. */}
            <div className="relative aspect-[4/3] w-full shrink-0 self-stretch overflow-hidden rounded-t-lg border-b border-border bg-secondary sm:w-[260px] sm:rounded-l-lg sm:rounded-tr-none sm:border-b-0 sm:border-r">
              <Link href={editHref(d)} className="block size-full">
                {d.imageUrl ? (
                  <Image src={d.imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 260px" className="object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center">
                    {d.kind === "sketch" ? (
                      <Pencil className="size-7 text-muted-foreground" strokeWidth={1.8} />
                    ) : (
                      <LayoutDashboard className="size-7 text-muted-foreground" strokeWidth={1.8} />
                    )}
                  </span>
                )}
                <span className="absolute left-2.5 top-2.5 rounded-md border border-border bg-background/85 px-1.5 py-1 font-mono text-[10px] uppercase tracking-wide text-primary">
                  {d.kind === "sketch" ? "Ciornă de schiță" : "Ciornă de detaliu"}
                </span>
              </Link>
            </div>

            {/* Conținutul. */}
            <div className="relative flex min-w-0 flex-1 flex-col p-5">
              <Link href={editHref(d)} className="no-underline">
                <h3 className="mb-1 pr-8 font-bold leading-snug text-foreground hover:underline">{title}</h3>
              </Link>

              <div className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11.5px] text-muted-foreground">
                <span>{d.kind === "sketch" ? "ciornă de schiță" : "ciornă de detaliu"}</span>
                <span className="text-border">·</span>
                {/* timeZone fix explicit — vezi lib/format.ts pt detaliul mismatch-ului server/client. */}
                <span>începută {d.createdAt.toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest" })}</span>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3">
                <Link
                  href={editHref(d)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground no-underline transition-colors hover:border-primary"
                >
                  Continuă <span aria-hidden>→</span>
                </Link>
                <form action={(fd) => onDelete(d, fd)}>
                  <input type="hidden" name={d.kind === "sketch" ? "sketchId" : "detailId"} value={d.id} />
                  <button
                    type="submit"
                    aria-label="Șterge ciorna"
                    title="Șterge ciorna"
                    className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
