import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DetailCard } from "@/components/detail-card";
import { FeedRail } from "@/components/feed-rail";
import { FeedSearch } from "@/components/feed-search";
import { FeedSidebar } from "@/components/feed-sidebar";
import { ProductTour } from "@/components/product-tour";
import { auth } from "@/lib/auth";
import { getUserMedia } from "@/server/repos/usersRepo";
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";
import { listCategoriesWithCounts } from "@/server/services/categoryService";
import {
  getActiveAuthors,
  getFeed,
  getMySavedDetailIds,
  getPublishedDetailsCount,
  getTopDebated,
} from "@/server/services/detailService";
import { getUserRole } from "@/server/services/roleService";
import { getPlatformState } from "@/server/services/settingsService";

import { FeedEmpty } from "./feed-empty";
import { FeedEntrance } from "./feed-entrance";

export const metadata: Metadata = { title: "Feed" };

// Feed = suprafața principală autenticată. Finit (~20), sortabil, filtrabil pe categorie.
// Layout pe 3 coloane (sidebar · feed · rail) — gen GitHub/LinkedIn, dens/profesional. Fără scroll infinit.
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; q?: string; welcome?: string; tour?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { cat, q: rawQ, welcome, tour } = await searchParams;
  const q = rawQ?.trim() || null;

  const [categories, totalPublished, role, authors, media, platform, debated] = await Promise.all([
    listCategoriesWithCounts(),
    getPublishedDetailsCount(),
    getUserRole(session.user.id),
    getActiveAuthors(5),
    getUserMedia(session.user.id),
    getPlatformState(),
    getTopDebated(7),
  ]);

  // Banner de ANUNȚ (in-app) — vizibil userilor logați cât anunțul e ON. Mesaj custom sau text implicit cu data.
  const announcement = platform.announcement;
  const maintenanceText = announcement.enabled
    ? announcement.message ??
      (announcement.date
        ? `În data ${new Date(announcement.date).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })} platforma va fi în mentenanță.`
        : "Platforma va intra în curând în mentenanță.")
    : null;

  const activeId = cat && categories.some((c) => c.id === cat) ? cat : null;
  const details = await getFeed({ categoryId: activeId, q });
  const mySavedIds = await getMySavedDetailIds(
    session.user.id,
    details.map((d) => d.id),
  );

  // Doar meseria (subRole) apare în platformă — rolul principal e doar grupare internă (lista_meserii.md).
  const roleLabel = role
    ? (role.subRole ?? ROLE_MAIN_LABELS[role.roleMain as RoleMain] ?? role.roleMain)
    : null;


  return (
    <>
    <ProductTour active={tour === "1"} />
    <FeedEntrance welcome={welcome === "1"}>
    <div className="mx-auto grid w-full max-w-[var(--container-max)] grid-cols-1 items-start gap-6 px-6 pb-16 pt-7 lg:grid-cols-[248px_1fr] xl:grid-cols-[248px_1fr_280px]">
      <FeedSidebar
        profile={{
          name: media?.name ?? session.user.name ?? null,
          image: media?.image ?? session.user.image ?? null,
          coverImage: media?.coverImage ?? null,
          coverPosition: media?.coverPosition ?? null,
          location: media?.location ?? null,
          roleLabel,
          verified: role?.verificationStatus === "VERIFIED",
          about: media?.about ?? null,
        }}
        categories={categories}
        activeId={activeId}
        total={totalPublished}
      />

      <main className="min-w-0">
        {maintenanceText && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <span className="font-semibold">Mentenanță programată — </span>
            {maintenanceText}
          </div>
        )}
        {/* Titlu + căutare, într-un container propriu (nu mai încercăm să-l aliniem pixel-perfect cu
            cardul de profil din sidebar — 2026-07-06) — coboară puțin feed-ul sub header. */}
        <div className="mb-5 mt-2 flex items-center justify-between gap-3 rounded-lg bg-card px-4 py-3.5 ring-1 ring-foreground/10">
          <h1 className="text-xl font-bold tracking-tight">
            {q ? <>Rezultate pentru „{q}”</> : "Detalii în dezbatere"}
          </h1>
          {/* Căutare — mutată aici din header-ul global (2026-07-06), lângă titlu. As-you-type cu debounce,
              fără submit/Enter (2026-08-07) — vezi components/feed-search.tsx. */}
          <FeedSearch initialQuery={q ?? ""} />
        </div>

        {details.length === 0 ? (
          <FeedEmpty filtered={!!activeId || !!q} search={!!q} />
        ) : (
          <div className="flex flex-col gap-4">
            {details.map((d) => (
              <DetailCard
                key={d.id}
                detail={d}
                currentUserId={session.user.id}
                isSaved={mySavedIds.has(d.id)}
              />
            ))}
          </div>
        )}
      </main>

      <FeedRail authors={authors} debated={debated} />
    </div>
    </FeedEntrance>
    </>
  );
}
