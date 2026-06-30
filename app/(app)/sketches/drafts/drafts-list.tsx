"use client";

import { Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useOptimistic } from "react";

import { deleteDraftAction } from "./actions";

type Draft = {
  id: string;
  detailImageUrl: string;
  detailTitle: string;
  createdAt: Date;
};

// Lista de ciorne cu ștergere OPTIMISTĂ: rândul dispare instant la click (nu mai pare „blocat" cât
// rulează server action-ul). deleteDraftAction face ștergerea reală + revalidatePath; dacă pică,
// revalidarea readuce rândul (useOptimistic se resincronizează cu prop-ul `drafts`).
export function DraftsList({ drafts }: { drafts: Draft[] }) {
  const [optimisticDrafts, removeDraft] = useOptimistic(drafts, (state, id: string) =>
    state.filter((d) => d.id !== id),
  );

  async function onDelete(formData: FormData) {
    removeDraft(String(formData.get("sketchId")));
    await deleteDraftAction(formData);
  }

  if (optimisticDrafts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Nu ai nicio ciornă salvată. O schiță pornește dintr-un detaliu, prin „Dezaprob și fac o schiță”.
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
    <ul className="flex flex-col gap-3">
      {optimisticDrafts.map((d) => (
        <li
          key={d.id}
          className="flex items-center gap-2 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary"
        >
          <Link href={`/sketches/${d.id}/edit`} className="flex min-w-0 flex-1 items-center gap-4">
            <span className="relative block h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
              <Image
                src={d.detailImageUrl}
                alt=""
                fill
                sizes="80px"
                className="object-cover opacity-90"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-foreground">
                Schiță peste „{d.detailTitle}”
              </span>
              <span className="mt-0.5 block font-mono text-[11.5px] text-muted-foreground">
                ciornă · începută {d.createdAt.toLocaleDateString("ro-RO")}
              </span>
            </span>
            <span className="hidden shrink-0 font-mono text-[12px] font-medium text-primary sm:block">
              Continuă →
            </span>
          </Link>
          <form action={onDelete}>
            <input type="hidden" name="sketchId" value={d.id} />
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
