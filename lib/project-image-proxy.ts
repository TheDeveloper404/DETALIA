import { NextResponse } from "next/server";

import { isOwnBlobUrl } from "@/lib/blob-url";
import { readOwnBlob } from "@/lib/blob-store";

// SEC-005 (audit 2026-08-11): fetch server-side al blob-ului + streaming către client, folosit de
// ambele rute `/api/project-image/*` DUPĂ ce apelantul a verificat accesul (poarta stă în route.ts,
// nu aici). `Cache-Control: private, no-store` — un membru eliminat nu trebuie să mai poată vedea
// imaginea nici din cache-ul browserului la următoarea cerere; verificarea de acces rulează din nou
// la fiecare request. Componentele Image care consumă aceste rute trebuie să folosească `unoptimized`
// (Next.js Image Optimization API cache-uiește PUBLIC, la nivel de CDN, ceea ce ar bypassa poarta).
//
// DET-03: citire autentificata din store privat. Fallback public numai pentru fisierele vechi,
// pana la cutover-ul documentat. Eliminarea copiilor publice este parte obligatorie a migrarii.
export async function proxyBlobImage(url: string, fileName?: string): Promise<NextResponse> {
  if (!isOwnBlobUrl(url)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Imagine indisponibilă." } },
      { status: 404 },
    );
  }
  let upstream;
  try {
    upstream = await readOwnBlob(url);
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Fisierul nu poate fi citit acum." } }, {
      status: 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (!upstream) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Imagine indisponibilă." } },
      { status: 404 },
    );
  }
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(fileName ? { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}` } : {}),
    },
  });
}
