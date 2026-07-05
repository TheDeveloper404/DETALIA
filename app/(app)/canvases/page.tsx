import { LayoutDashboard } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listMyCanvases } from "@/server/services/plansaService";

import { CanvasesList } from "./canvases-list";

// „Planșele mele" — colecția personală de planșe (canvas privat). Listă simplă, ca /saved.
export default async function CanvasesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const canvases = await listMyCanvases(session.user.id);

  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-6 pb-20 pt-8">
      <div className="mb-6 flex items-center gap-2.5">
        <LayoutDashboard className="size-5 text-primary" strokeWidth={2} />
        <h1 className="font-heading text-[26px] font-extrabold tracking-tight">Planșele mele</h1>
      </div>

      <CanvasesList
        canvases={canvases.map((c) => ({
          id: c.id,
          name: c.name,
          thumbnailUrl: c.thumbnailUrl,
          updatedAt: c.updatedAt.toISOString(),
        }))}
      />
    </main>
  );
}
