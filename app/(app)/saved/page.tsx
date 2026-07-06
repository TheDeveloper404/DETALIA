import { Bookmark } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DetailCard } from "@/components/detail-card";
import { auth } from "@/lib/auth";
import { getSavedDetails } from "@/server/services/detailService";
import { getMyPositions } from "@/server/services/validationService";

// Detaliile salvate de userul curent (bookmark din meniul „⋮" al detaliului). Listă simplă, o coloană,
// aceleași carduri ca feed-ul. Fără filtre/sortare (colecție personală, mică). Ordine: recent salvate primele.
export default async function SavedPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const details = await getSavedDetails(session.user.id);
  const myPositions = await getMyPositions(
    session.user.id,
    "DETAIL",
    details.map((d) => d.id),
  );

  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-6 pb-20 pt-8">
      <div className="mb-6 flex items-center gap-2.5">
        <Bookmark className="size-5 text-primary" strokeWidth={2} />
        <h1 className="font-heading text-[26px] font-extrabold tracking-tight">Detalii salvate</h1>
      </div>

      {details.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-card px-8 py-16 text-center">
          <div className="mb-[22px] flex size-16 items-center justify-center rounded-lg border border-border bg-secondary">
            <Bookmark className="size-7 text-primary" strokeWidth={1.8} />
          </div>
          <h2 className="mb-2 text-[22px] font-bold">Niciun detaliu salvat</h2>
          <p className="mb-6 max-w-[42ch] leading-relaxed text-muted-foreground">
            Salvează detalii din meniul „⋮” ca să le regăsești aici, într-un singur loc.
          </p>
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 rounded-lg border border-[#95492e] bg-primary px-[22px] py-3 font-semibold text-primary-foreground no-underline transition-colors hover:bg-[#974a2e]"
          >
            Explorează feed-ul
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {details.map((d) => (
            <DetailCard
              key={d.id}
              detail={d}
              myPosition={myPositions.get(d.id) ?? null}
              currentUserId={session.user.id}
              isSaved
            />
          ))}
        </div>
      )}
    </main>
  );
}
