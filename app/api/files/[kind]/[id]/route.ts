import { NextResponse } from "next/server";

import { proxyBlobImage } from "@/lib/project-image-proxy";
import { requireActiveApiUserId } from "@/lib/require-active-api-user";
import { getReadableBlobFile } from "@/server/services/blobFileService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params;
  try {
    const identity = await requireActiveApiUserId();
    const result = await getReadableBlobFile(kind, id, identity.ok ? identity.userId : null);
    if (!result.ok) {
      if (result.error === "UNAUTHORIZED" && !identity.ok) return identity.response;
      return NextResponse.json(
        { error: { code: result.error, message: "Fisier indisponibil." } },
        {
          status: result.error === "NOT_FOUND" ? 404 : 403,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }
    return proxyBlobImage(result.url, result.fileName);
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Fisierul nu poate fi citit acum." } },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
