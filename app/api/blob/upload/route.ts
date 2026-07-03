import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkLimit, limiters } from "@/lib/rate-limit";
import {
  ALLOWED_CAD_EXTENSIONS,
  ALLOWED_CAD_TYPES,
  ALLOWED_DOC_TYPES,
  ALLOWED_IMAGE_TYPES,
  MAX_CAD_BYTES,
  MAX_DOC_BYTES,
  MAX_IMAGE_BYTES,
} from "@/lib/upload-limits";

// "kind" vine din clientPayload (setat de client în uploadFileToBlob) — alege allowlist-ul de
// tip/mărime pe server. Default "image" dacă lipsește/e necunoscut (fail-safe, cel mai restrictiv).
type UploadKind = "image" | "pdf" | "cad";
function resolveKind(clientPayload: string | null): UploadKind {
  if (clientPayload === "pdf" || clientPayload === "cad") return clientPayload;
  return "image";
}

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
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await auth();
        if (!session?.user?.id) {
          throw new Error("UNAUTHORIZED");
        }
        // SEC-01: cotă de upload per user (emiterea tokenului = poarta).
        if (!(await checkLimit(limiters.upload, session.user.id)).ok) {
          throw new Error("RATE_LIMITED");
        }

        const kind = resolveKind(clientPayload);
        if (kind === "pdf") {
          return {
            allowedContentTypes: [...ALLOWED_DOC_TYPES],
            maximumSizeInBytes: MAX_DOC_BYTES,
            addRandomSuffix: true,
          };
        }
        if (kind === "cad") {
          // DWG/DXF n-au MIME type de încredere din browser → gate real pe extensia din pathname
          // (pe care ÎL controlăm noi, vezi uploadFileToBlob), nu doar pe content-type.
          const ext = pathname.split(".").pop()?.toLowerCase();
          if (!ext || !(ALLOWED_CAD_EXTENSIONS as readonly string[]).includes(ext)) {
            throw new Error("INVALID_TYPE");
          }
          return {
            allowedContentTypes: [...ALLOWED_CAD_TYPES],
            maximumSizeInBytes: MAX_CAD_BYTES,
            addRandomSuffix: true,
          };
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
    const rateLimited = err instanceof Error && err.message === "RATE_LIMITED";
    if (!unauthorized && !rateLimited) {
      // Motivul real (eroare SDK/config Blob — NU PII) → vizibil în Vercel Logs ca să diagnosticăm 400-ul.
      console.error("blob upload route 400:", err instanceof Error ? err.message : String(err));
    }
    if (rateLimited) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Prea multe încărcări. Așteaptă un moment." } },
        { status: 429 },
      );
    }
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
