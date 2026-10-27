import { NextResponse } from "next/server";

import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveApiUserId } from "@/lib/require-active-api-user";
import { isUuid } from "@/server/domain/ids";
import { saveCanvasThumbnail } from "@/server/services/plansaService";

// Separat de dispatcher-ul Server Actions: procesarea miniaturii nu blocheaza documentul.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Cerere nepermisa." } }, { status: 403 });
    }
    const identity = await requireActiveApiUserId();
    if (!identity.ok) return identity.response;
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Planșa nu mai există." } }, { status: 404 });
    if (!(await checkLimit(limiters.mutation, identity.userId)).ok) {
      return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Prea multe salvări. Așteaptă un moment." } }, { status: 429 });
    }
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !("thumbnailUrl" in body) || typeof body.thumbnailUrl !== "string") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Thumbnail-ul nu a putut fi salvat." } }, { status: 400 });
    }
    const result = await saveCanvasThumbnail({ canvasId: id, ownerId: identity.userId, thumbnailUrl: body.thumbnailUrl });
    if (!result.ok) {
      const missing = result.error === "NOT_FOUND";
      return NextResponse.json({ error: { code: missing ? "NOT_FOUND" : "VALIDATION_ERROR", message: missing ? "Planșa nu mai există." : "Thumbnail-ul nu a putut fi salvat." } }, { status: missing ? 404 : 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Thumbnail-ul nu a putut fi salvat." } }, { status: 500 });
  }
}
