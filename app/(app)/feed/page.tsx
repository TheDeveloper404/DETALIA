import { Search } from "lucide-react";
import { redirect } from "next/navigation";

import { DetailCard } from "@/components/detail-card";
import { FeedRail } from "@/components/feed-rail";
import { FeedSidebar } from "@/components/feed-sidebar";
import { auth } from "@/lib/auth";
import { getUserMedia } from "@/server/repos/usersRepo";
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";
import { listCategoriesWithCounts } from "@/server/services/categoryService";
import { type FeedSort, getActiveAuthors, getFeed, getMySavedDetailIds } from "@/server/services/detailService";
import { getUserRole } from "@/server/services/roleService";
import { getPlatformState } from "@/server/services/settingsService";
import { getMyPositions } from "@/server/services/validationService";

import { FeedEmpty } from "./feed-empty";
import { FeedEntrance } from "./feed-entrance";

// Feed = suprafața principală autenticată. Finit (~20), sortabil, filtrabil pe categorie.
// Layout pe 3 coloane (sidebar · feed · rail) — gen GitHub/LinkedIn, dens/profesional. Fără scroll infinit.
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; sort?: string; q?: string; welcome?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { cat, sort: sortParam, q: rawQ, welcome } = await searchParams;
  const q = rawQ?.trim() || null;
  const sort: FeedSort = sortParam === "recent" ? "recent" : "debated";

  const [categories, role, authors, media, platform] = await Promise.all([
    listCategoriesWithCounts(),
    getUserRole(session.user.id),
    getActiveAuthors(5),
    getUserMedia(session.user.id),
    getPlatformState(),
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
  const details = await getFeed({ categoryId: activeId, q, sort });
  const myPositions = await getMyPositions(
    session.user.id,
    "DETAIL",
    details.map((d) => d.id),
  );
  const mySavedIds = await getMySavedDetailIds(
    session.user.id,
    details.map((d) => d.id),
  );

  const total = categories.reduce((sum, c) => sum + c.count, 0);
  const roleLabel = role
    ? `${ROLE_MAIN_LABELS[role.roleMain as RoleMain] ?? role.roleMain}${role.subRole ? ` · ${role.subRole}` : ""}`
    : null;

  const debated = [...details]
    .sort((a, b) => b.commentCount - a.commentCount)
    .slice(0, 3)
    .map((d) => ({
      id: d.id,
      title: d.title,
      commentCount: d.commentCount,
      sketchCount: d.sketchCount,
    }));


  return (
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
        }}
        categories={categories}
        activeId={activeId}
        total={total}
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
            cardul de profil din sidebar — decizie Liviu, 2026-07-06) — coboară puțin feed-ul sub header. */}
        <div className="mb-5 mt-2 flex items-center justify-between gap-3 rounded-lg bg-card px-4 py-3.5 ring-1 ring-foreground/10">
          <h1 className="text-xl font-bold tracking-tight">
            {q ? <>Rezultate pentru „{q}”</> : "Detalii în dezbatere"}
          </h1>
          {/* Căutare — mutată aici din header-ul global (2026-07-06), lângă titlu. */}
          <form action="/feed" className="w-full max-w-[280px]" role="search">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2}
              />
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Caută detalii…"
                aria-label="Caută detalii"
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>
          </form>
        </div>

        {details.length === 0 ? (
          <FeedEmpty filtered={!!activeId || !!q} search={!!q} />
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

      <FeedRail authors={authors} debated={debated} />
    </div>
    </FeedEntrance>
  );
}
