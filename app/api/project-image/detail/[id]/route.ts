import { NextResponse } from "next/server";

import { proxyBlobImage } from "@/lib/project-image-proxy";
import { requireActiveApiUserId } from "@/lib/require-active-api-user";
import { isUuid } from "@/server/domain/ids";
import { getProjectDetailImage } from "@/server/repos/detailsRepo";
import { canAccessProjectDetail } from "@/server/services/projectService";

// SEC-005 (audit securitate 2026-08-11): imaginile de detaliu-de-proiect stăteau pe URL-uri Vercel
// Blob PUBLICE — un membru eliminat păstra linkul direct și le putea reîncărca oricând. Poarta stă
// AICI, verificată la fiecare cerere (nu doar la randarea paginii): un detaliu FĂRĂ projectId (deja
// scos în comunitate) e public — nu are sens prin proxy, dar componenta client oricum nu-l trimite pe
// aici (vezi content-grid.tsx, `releasedDetails` folosește URL direct).
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

  const detail = await getProjectDetailImage(id);
  // Anti-enumerare: „nu există", „fără imagine" și „nu ai acces" arată IDENTIC (404) — altfel un
  // răspuns diferit ar confirma existența unui detaliu privat la care nu ai acces.
  if (!detail || !detail.imageUrl || !detail.projectId) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Nu a fost găsit." } }, { status: 404 });
  }
  const hasAccess = await canAccessProjectDetail({ projectId: detail.projectId, userId: authResult.userId });
  if (!hasAccess) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Nu a fost găsit." } }, { status: 404 });
  }

  return proxyBlobImage(detail.imageUrl);
}
