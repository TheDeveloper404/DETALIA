import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DetailCard } from "@/components/detail-card";
import { FeedRail } from "@/components/feed-rail";
import { FeedSearch } from "@/components/feed-search";
import { FeedSidebar } from "@/components/feed-sidebar";
import { MobileCategoryFilter } from "@/components/mobile-category-filter";
import { ProductTour } from "@/components/product-tour";
import { WhatsNewModal } from "@/components/whats-new-modal";
import { auth } from "@/lib/auth";
import { getUserMedia } from "@/server/repos/usersRepo";
import { getUnseenAnnouncement } from "@/server/services/announcementService";
import { resolveFeedPage } from "@/server/domain/detail";
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";
import { listCategoriesWithCounts } from "@/server/services/categoryService";
import {
  getActiveAuthors,
  getFeed,
  getMySavedDetailIds,
  getPublishedDetailsCount,
  getSavedDetailsCount,
  getTopDebated,
} from "@/server/services/detailService";
import { getUserRole } from "@/server/services/roleService";
import { getPlatformState } from "@/server/services/settingsService";

import { FeedEmpty } from "./feed-empty";
import { FeedEntrance } from "./feed-entrance";
import { FeedPagination } from "./feed-pagination";

export const metadata: Metadata = { title: "Feed" };

// Feed = suprafața principală autenticată. Paginat (50/pagină), sortabil, filtrabil pe categorie.
// Layout pe 3 coloane (sidebar · feed · rail) — gen GitHub/LinkedIn, dens/profesional. Fără scroll
// infinit — paginare stil forum (decizie 2026-08-16), păstrează filtrele active (?cat=/?q=).
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{
    cat?: string;
    q?: string;
    unanswered?: string;
    welcome?: string;
    tour?: string;
    page?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { cat, q: rawQ, unanswered: rawUnanswered, welcome, tour, page: rawPage } = await searchParams;
  const q = rawQ?.trim() || null;
  const unanswered = rawUnanswered === "1";
  const page = resolveFeedPage(rawPage);

  const [categories, totalPublished, role, authors, media, platform, debated, unseenAnnouncement, savedCount] =
    await Promise.all([
      listCategoriesWithCounts(),
      getPublishedDetailsCount(),
      getUserRole(session.user.id),
      getActiveAuthors(5),
      getUserMedia(session.user.id),
      getPlatformState(),
      getTopDebated(7),
      getUnseenAnnouncement(session.user.id),
      getSavedDetailsCount(session.user.id),
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
  const { details, totalPages } = await getFeed({ categoryId: activeId, q, unanswered, page });

  // Href-ul care comută filtrul „Fără răspuns", păstrând categoria + căutarea (dar resetând pagina).
  const buildToggleHref = (next: boolean) => {
    const params = new URLSearchParams();
    if (activeId) params.set("cat", activeId);
    if (q) params.set("q", q);
    if (next) params.set("unanswered", "1");
    const qs = params.toString();
    return qs ? `/feed?${qs}` : "/feed";
  };

  // `?page=` peste ultima pagină reală (filtru schimbat între timp, link vechi/manipulat) → redirect la
  // ultima pagină validă, NU „Niciun rezultat" fals pentru un filtru care chiar are rezultate.
  if (page > totalPages) {
    const params = new URLSearchParams();
    if (activeId) params.set("cat", activeId);
    if (q) params.set("q", q);
    if (unanswered) params.set("unanswered", "1");
    if (totalPages > 1) params.set("page", String(totalPages));
    const qs = params.toString();
    redirect(qs ? `/feed?${qs}` : "/feed");
  }

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
    <ProductTour active={tour === "1"} hasFeedItems={details.length > 0} />
    {/* Suprimat complet la userul chiar nou (tur activ) — apare firesc la a DOUA vizită, nu întârziat
        peste tur (2026-08-26, vezi comentariul din whats-new-modal.tsx). */}
    <WhatsNewModal items={tour === "1" ? [] : (unseenAnnouncement ?? [])} />
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
        savedCount={savedCount}
        q={q}
        unanswered={unanswered}
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
        <div className="mb-5 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card px-4 py-3.5 ring-1 ring-foreground/10">
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">
            {q ? <>Rezultate pentru „{q}”</> : "Detalii în dezbatere"}
          </h1>
          <div className="flex flex-none items-center gap-2">
            {/* „Fără răspuns" — detalii la care nimeni n-a schițat ȘI nimeni n-a luat poziție (0
                schițe + 0 validări). Link server, păstrează cat/q, resetează pagina. */}
            <Link
              href={buildToggleHref(!unanswered)}
              aria-pressed={unanswered}
              className={`flex h-11 flex-none items-center gap-1.5 rounded-full px-5 text-[13.5px] font-medium no-underline ring-1 transition-colors ${
                unanswered
                  ? "bg-primary text-primary-foreground ring-[#95492e]"
                  : "bg-card text-foreground/80 ring-foreground/10 hover:text-foreground"
              }`}
            >
              Fără răspuns
            </Link>
            <MobileCategoryFilter categories={categories} activeId={activeId} basePath="/feed" total={totalPublished} q={q} unanswered={unanswered} />
            {/* Căutare — mutată aici din header-ul global (2026-07-06), lângă titlu. As-you-type cu debounce,
                fără submit/Enter (2026-08-07) — vezi components/feed-search.tsx. */}
            <FeedSearch initialQuery={q ?? ""} />
          </div>
        </div>

        {details.length === 0 ? (
          <FeedEmpty filtered={!!activeId || !!q || unanswered} search={!!q} unanswered={unanswered} />
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {details.map((d, i) => (
                <DetailCard
                  key={d.id}
                  detail={d}
                  currentUserId={session.user.id}
                  isSaved={mySavedIds.has(d.id)}
                  searchQuery={q}
                  tourAnchor={i === 0}
                />
              ))}
            </div>
            <FeedPagination page={page} totalPages={totalPages} categoryId={activeId} q={q} unanswered={unanswered} />
          </>
        )}
      </main>

      <FeedRail authors={authors} debated={debated} />
    </div>
    </FeedEntrance>
    </>
  );
}
