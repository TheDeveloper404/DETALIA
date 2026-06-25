import { Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getMyDrafts } from "@/server/services/sketchService";

import { deleteDraftAction } from "./actions";

// „Ciornele mele" — schițele DRAFT ale userului, reluabile oricând (rezolvă dead-end-ul: o ciornă
// salvată nu mai depindea de păstrarea manuală a URL-ului editorului).
export default async function DraftsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const drafts = await getMyDrafts(session.user.id);

  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] flex-1 px-6 pb-20 pt-7">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Ciornele mele</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Schițe pe care le-ai început, dar nu le-ai trimis încă. Le reiei oricând.
        </p>
      </header>

      {drafts.length === 0 ? (
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
      ) : (
        <ul className="flex flex-col gap-3">
          {drafts.map((d) => (
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
              <form action={deleteDraftAction}>
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
      )}
    </main>
  );
}
