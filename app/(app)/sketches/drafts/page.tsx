import { PencilLine } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getMyDetailDrafts } from "@/server/services/detailService";
import { getMyDrafts } from "@/server/services/sketchService";

import { DraftsList, type UnifiedDraft } from "./drafts-list";

// „Ciornele mele" — UNIFICAT (2026-07-06): schițe DRAFT + detalii DRAFT ale userului, reluabile
// oricând, într-o singură listă (decizie Liviu — o singură pagină, nu două concepte separate).
export default async function DraftsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [sketchDrafts, detailDrafts] = await Promise.all([
    getMyDrafts(session.user.id),
    getMyDetailDrafts(session.user.id),
  ]);

  const drafts: UnifiedDraft[] = [
    ...sketchDrafts.map(
      (d): UnifiedDraft => ({
        kind: "sketch",
        id: d.id,
        detailId: d.detailId,
        title: d.detailTitle,
        // Detaliul-mamă al unei schițe e mereu PUBLISHED (join direct) → imagine mereu setată.
        imageUrl: d.detailImageUrl,
        createdAt: d.createdAt,
      }),
    ),
    ...detailDrafts.map(
      (d): UnifiedDraft => ({ kind: "detail", id: d.id, title: d.title, imageUrl: d.imageUrl, createdAt: d.createdAt }),
    ),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] flex-1 px-6 pb-20 pt-7">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <PencilLine className="size-5 text-primary" strokeWidth={2} />
          <h1 className="font-heading text-[26px] font-extrabold tracking-tight">Ciornele mele</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Schițe și detalii pe care le-ai început, dar nu le-ai trimis încă. Le reiei oricând.
        </p>
      </header>

      <DraftsList drafts={drafts} />
    </main>
  );
}
