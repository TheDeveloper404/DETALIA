// Repo partajări de planșă în proiect — singurul loc cu acces Drizzle pentru `project_canvas_shares`.
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { projectCanvasShares } from "@/db/schema";

// SEC-010 (audit securitate 2026-08-11): plafon de partajări per proiect — anti-abuz (fiecare
// partajare consumă un blob full-size nou, plătit).
export async function countCanvasSharesByProject(projectId: string): Promise<number> {
  const [row] = await db.select({ c: count() }).from(projectCanvasShares).where(eq(projectCanvasShares.projectId, projectId));
  return row?.c ?? 0;
}

export async function insertCanvasShare(input: {
  projectId: string;
  sharedByUserId: string;
  name: string;
  imageUrl: string;
}) {
  const [row] = await db.insert(projectCanvasShares).values(input).returning();
  return row;
}

export function listCanvasSharesByProject(projectId: string) {
  return db
    .select()
    .from(projectCanvasShares)
    .where(eq(projectCanvasShares.projectId, projectId))
    .orderBy(desc(projectCanvasShares.createdAt));
}

export async function getCanvasShareById(id: string) {
  const [row] = await db
    .select()
    .from(projectCanvasShares)
    .where(eq(projectCanvasShares.id, id))
    .limit(1);
  return row ?? null;
}

// Întoarce `imageUrl` (pentru curățarea blob-ului) doar dacă rândul chiar există și e șters — apelantul
// (service) verifică deja accesul înainte (owner planșă SAU owner proiect), nu re-verificăm aici.
export async function deleteCanvasShare(id: string): Promise<string | null> {
  const [row] = await db
    .delete(projectCanvasShares)
    .where(eq(projectCanvasShares.id, id))
    .returning({ imageUrl: projectCanvasShares.imageUrl });
  return row?.imageUrl ?? null;
}
