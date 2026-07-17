import { Hand } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DetailCard } from "@/components/detail-card";
import { auth } from "@/lib/auth";
import { getMySavedDetailIds, getOfferedDetails } from "@/server/services/detailService";
import { getUserRole } from "@/server/services/roleService";
import { getMyPositions } from "@/server/services/validationService";

// „Ofertele mele" — PRIVATĂ, doar rol FURNIZOR (verificat din DB, nu din client — un non-Furnizor care
// accesează URL-ul direct primește listă goală + mesaj, nu datele altcuiva; oricum query-ul e scopat
// strict pe userId din sesiune, deci n-ar vedea decât propriile lui rânduri, dar rolul greșit = 0 rânduri).
// Aceleași carduri ca /saved — listă simplă, fără filtre (colecție personală, mică).
export default async function MyOffersPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const role = await getUserRole(session.user.id);
  const isFurnizor = role?.roleMain === "FURNIZOR";

  const details = isFurnizor ? await getOfferedDetails(session.user.id) : [];
  const myPositions = await getMyPositions(
    session.user.id,
    "DETAIL",
    details.map((d) => d.id),
  );
  // Detaliile ofertate sunt auto-salvate (toggleSupplierOffer, 2026-07-17) — fără asta, bookmark-ul
  // din card ar arăta greșit „nesalvat" pentru un detaliu care de fapt e deja în /saved.
  const mySavedIds = await getMySavedDetailIds(
    session.user.id,
    details.map((d) => d.id),
  );

  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] flex-1 px-6 pb-20 pt-8">
      <div className="mb-6 flex items-center gap-2.5">
        <Hand className="size-5 text-primary" strokeWidth={2} />
        <h1 className="font-heading text-[26px] font-extrabold tracking-tight">Ofertele mele</h1>
      </div>

      {!isFurnizor ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-card px-8 py-16 text-center">
          <div className="mb-[22px] flex size-16 items-center justify-center rounded-lg border border-border bg-secondary">
            <Hand className="size-7 text-primary" strokeWidth={1.8} />
          </div>
          <h2 className="mb-2 text-[22px] font-bold">Disponibil doar pentru Furnizori</h2>
          <p className="mb-6 max-w-[42ch] leading-relaxed text-muted-foreground">
            Această secțiune arată detaliile pe care ai ridicat mâna că poți oferta materiale — vizibilă
            doar rolului Furnizor.
          </p>
        </div>
      ) : details.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-card px-8 py-16 text-center">
          <div className="mb-[22px] flex size-16 items-center justify-center rounded-lg border border-border bg-secondary">
            <Hand className="size-7 text-primary" strokeWidth={1.8} />
          </div>
          <h2 className="mb-2 text-[22px] font-bold">Nicio ofertă încă</h2>
          <p className="mb-6 max-w-[42ch] leading-relaxed text-muted-foreground">
            Apasă „Pot să ofertez materiale” pe un detaliu ca să apară aici.
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
              isSaved={mySavedIds.has(d.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
