import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getMyDrafts } from "@/server/services/sketchService";

import { DraftsList } from "./drafts-list";

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

      <DraftsList drafts={drafts} />
    </main>
  );
}
