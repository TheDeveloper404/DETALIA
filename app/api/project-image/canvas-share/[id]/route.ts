import { NextResponse } from "next/server";

import { proxyBlobImage } from "@/lib/project-image-proxy";
import { requireActiveApiUserId } from "@/lib/require-active-api-user";
import { isUuid } from "@/server/domain/ids";
import { getCanvasShareById } from "@/server/repos/projectCanvasSharesRepo";
import { canAccessProjectDetail } from "@/server/services/projectService";

// SEC-005 (audit securitate 2026-08-11): la fel ca /api/project-image/detail/[id], dar pentru
// thumbnail-ul unei planșe partajate în proiect (project_canvas_shares.imageUrl) — vezi comentariul
// din acel fișier pentru raționamentul complet.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Nu a fost găsit." } }, { status: 404 });
  }

  const authResult = await requireActiveApiUserId();
  if (!authResult.ok) return authResult.response;

  const share = await getCanvasShareById(id);
  if (!share) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Nu a fost găsit." } }, { status: 404 });
  }
  const hasAccess = await canAccessProjectDetail({ projectId: share.projectId, userId: authResult.userId });
  if (!hasAccess) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Nu a fost găsit." } }, { status: 404 });
  }

  return proxyBlobImage(share.imageUrl);
}
