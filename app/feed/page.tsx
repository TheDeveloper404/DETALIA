import { redirect } from "next/navigation";

import { DetailCard } from "@/components/detail-card";
import { FeedRail } from "@/components/feed-rail";
import { FeedSidebar } from "@/components/feed-sidebar";
import { auth } from "@/lib/auth";
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";
import { listCategoriesWithCounts } from "@/server/services/categoryService";
import { getFeed } from "@/server/services/detailService";
import { getUserRole } from "@/server/services/roleService";

import { FeedEmpty } from "./feed-empty";

// Feed = suprafața principală autenticată. Finit (~20), sortat după interacțiuni, filtrabil pe categorie.
// Layout pe 3 coloane (sidebar · feed · rail) — gen GitHub/LinkedIn, dens/profesional. Fără scroll infinit.
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { cat } = await searchParams;
  const [categories, role] = await Promise.all([
    listCategoriesWithCounts(),
    getUserRole(session.user.id),
  ]);

  const activeId = cat && categories.some((c) => c.id === cat) ? cat : null;
  const details = await getFeed({ categoryId: activeId });

  const total = categories.reduce((sum, c) => sum + c.count, 0);
  const roleLabel = role
    ? `${ROLE_MAIN_LABELS[role.roleMain as RoleMain] ?? role.roleMain}${role.subRole ? ` · ${role.subRole}` : ""}`
    : null;

  const popular = [...categories].sort((a, b) => b.count - a.count).slice(0, 4);
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
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Detalii recente</h1>
          <div className="font-mono text-xs text-muted-foreground">
            sortează: <span className="text-foreground">în dezbatere</span>
          </div>
        </div>

        {details.length === 0 ? (
          <FeedEmpty filtered={!!activeId} />
        ) : (
          <div className="flex flex-col gap-4">
            {details.map((d) => (
              <DetailCard key={d.id} detail={d} />
            ))}
          </div>
        )}
      </main>

      <FeedRail categories={popular} debated={debated} />
    </div>
  );
}
