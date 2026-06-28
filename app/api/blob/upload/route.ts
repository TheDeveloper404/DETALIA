import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/upload-limits";

// Emite tokenul pentru upload CLIENT direct în Blob (browser → Blob). Ocolește limita de body a
// server actions (1MB implicit în Next) ȘI plafonul de ~4.5MB al funcțiilor Vercel → fișiere mari OK.
//
// SECURITATE: aici e poarta. `onBeforeGenerateToken` rulează pe server ÎNAINTE de upload și:
//  - cere sesiune (deny-by-default) → doar userii logați pot urca;
//  - restrânge tipul (doar imagini) și mărimea (MAX_IMAGE_BYTES) — Blob refuză ce iese din token.
// Persistarea URL-ului în DB NU se face aici: `onUploadCompleted` (callback Vercel) nu rulează pe
// localhost, așa că URL-ul întors de upload se salvează printr-un server action separat (vezi profile/actions.ts).
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user?.id) {
          throw new Error("UNAUTHORIZED");
        }
        return {
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },
      // Persistarea o face server action-ul după upload (callback indisponibil pe localhost).
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(json);
  } catch (err) {
    // Fără internals în răspuns (convenția de erori a proiectului).
    const unauthorized = err instanceof Error && err.message === "UNAUTHORIZED";
    return NextResponse.json(
      {
        error: {
          code: unauthorized ? "UNAUTHORIZED" : "UPLOAD_FAILED",
          message: unauthorized ? "Autentificare necesară." : "Încărcarea nu a putut fi pregătită.",
        },
      },
      { status: unauthorized ? 401 : 400 },
    );
  }
}
