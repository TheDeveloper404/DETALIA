import Link from "next/link";
import { redirect } from "next/navigation";

import { DetailCard } from "@/components/detail-card";
import { FeedRail } from "@/components/feed-rail";
import { FeedSidebar } from "@/components/feed-sidebar";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";
import { listCategoriesWithCounts } from "@/server/services/categoryService";
import { type FeedSort, getActiveAuthors, getFeed } from "@/server/services/detailService";
import { getUserRole } from "@/server/services/roleService";
import { getMyPositions } from "@/server/services/validationService";

import { FeedEmpty } from "./feed-empty";

// Feed = suprafața principală autenticată. Finit (~20), sortabil, filtrabil pe categorie.
// Layout pe 3 coloane (sidebar · feed · rail) — gen GitHub/LinkedIn, dens/profesional. Fără scroll infinit.
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; sort?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { cat, sort: sortParam } = await searchParams;
  const sort: FeedSort = sortParam === "recent" ? "recent" : "debated";

  const [categories, role, authors] = await Promise.all([
    listCategoriesWithCounts(),
    getUserRole(session.user.id),
    getActiveAuthors(5),
  ]);

  const activeId = cat && categories.some((c) => c.id === cat) ? cat : null;
  const details = await getFeed({ categoryId: activeId, sort });
  const myPositions = await getMyPositions(
    session.user.id,
    "DETAIL",
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

  // Linkuri de sortare care păstrează filtrul de categorie.
  const sortHref = (value: FeedSort) => {
    const params = new URLSearchParams();
    if (activeId) params.set("cat", activeId);
    if (value === "recent") params.set("sort", "recent");
    const qs = params.toString();
    return qs ? `/feed?${qs}` : "/feed";
  };

  return (
    <div className="mx-auto grid w-full max-w-[var(--container-max)] grid-cols-1 items-start gap-6 px-6 pb-16 pt-7 lg:grid-cols-[248px_1fr] xl:grid-cols-[248px_1fr_280px]">
      <FeedSidebar
        profile={{
          name: session.user.name ?? null,
          image: session.user.image ?? null,
          roleLabel,
          verified: role?.verificationStatus === "VERIFIED",
        }}
        categories={categories}
        activeId={activeId}
        total={total}
      />

      <main className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight">Detalii în dezbatere</h1>
          <div className="inline-flex shrink-0 rounded-lg border border-border bg-card p-0.5 font-mono text-[11.5px]">
            <Link
              href={sortHref("debated")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                sort === "debated"
                  ? "bg-secondary font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              În dezbatere
            </Link>
            <Link
              href={sortHref("recent")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                sort === "recent"
                  ? "bg-secondary font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Recente
            </Link>
          </div>
        </div>

        {details.length === 0 ? (
          <FeedEmpty filtered={!!activeId} />
        ) : (
          <div className="flex flex-col gap-4">
            {details.map((d) => (
              <DetailCard key={d.id} detail={d} myPosition={myPositions.get(d.id) ?? null} />
            ))}
          </div>
        )}
      </main>

      <FeedRail authors={authors} debated={debated} />
    </div>
  );
}
