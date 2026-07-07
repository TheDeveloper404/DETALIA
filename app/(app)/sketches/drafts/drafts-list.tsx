"use client";

import { LayoutDashboard, Pencil, Trash2 } from "lucide-react";
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

// Ștergere OPTIMISTĂ: rândul dispare instant la click, indiferent de tip. Fiecare tip își cheamă
// propriul server action (deleteDraftAction/deleteDetailDraftAction); dacă pică, revalidarea readuce rândul.
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
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Nu ai nicio ciornă salvată. O schiță pornește dintr-un detaliu, prin „Dezaprob și fac o schiță”,
          sau salvezi un detaliu nou ca ciornă din formularul de adăugare.
        </p>
        <Link
          href="/feed"
          className="mt-4 inline-flex items-center rounded-[9px] border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:border-primary"
        >
          Mergi la feed
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex list-none flex-col gap-3 p-0">
      {optimisticDrafts.map((d) => (
        <li
          key={d.id}
          className="flex items-center gap-2 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary"
        >
          <Link href={editHref(d)} className="flex min-w-0 flex-1 items-center gap-4">
            <span className="relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary">
              {d.imageUrl ? (
                <Image src={d.imageUrl} alt="" fill sizes="80px" className="object-cover opacity-90" />
              ) : d.kind === "sketch" ? (
                <Pencil className="size-5 text-muted-foreground" strokeWidth={1.8} />
              ) : (
                <LayoutDashboard className="size-5 text-muted-foreground" strokeWidth={1.8} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-foreground">
                {d.kind === "sketch" ? `Schiță peste „${d.title}”` : d.title || "Detaliu fără titlu"}
              </span>
              <span className="mt-0.5 block font-mono text-[11.5px] text-muted-foreground">
                {d.kind === "sketch" ? "ciornă de schiță" : "ciornă de detaliu"} · începută{" "}
                {/* timeZone fix explicit — vezi lib/format.ts pt detaliul mismatch-ului server/client. */}
                {d.createdAt.toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest" })}
              </span>
            </span>
            <span className="hidden shrink-0 font-mono text-[12px] font-medium text-primary sm:block">
              Continuă →
            </span>
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
        </li>
      ))}
    </ul>
  );
}
