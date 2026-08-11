import { NextResponse } from "next/server";

import { isOwnBlobUrl } from "@/lib/blob-url";

// SEC-005 (audit 2026-08-11): fetch server-side al blob-ului + streaming către client, folosit de
// ambele rute `/api/project-image/*` DUPĂ ce apelantul a verificat accesul (poarta stă în route.ts,
// nu aici). `Cache-Control: private, no-store` — un membru eliminat nu trebuie să mai poată vedea
// imaginea nici din cache-ul browserului la următoarea cerere; verificarea de acces rulează din nou
// la fiecare request. Componentele Image care consumă aceste rute trebuie să folosească `unoptimized`
// (Next.js Image Optimization API cache-uiește PUBLIC, la nivel de CDN, ceea ce ar bypassa poarta).
//
// GOL CUNOSCUT (găsit la /code-review QODO, 2026-08-11, NEREZOLVAT — decizie explicită de a nu extinde
// scopul azi): `url` de mai jos rămâne un blob Vercel PUBLIC (store-ul curent e configurat public la
// nivel de store, nu per-fișier — `access: "private"` cere un store SEPARAT, provizionare Vercel, nu
// doar cod). Poarta de aici blochează accesul prin UI normală, dar cine reține URL-ul brut (l-a văzut
// cât încă avea acces) îl poate accesa direct, ocolind complet proxy-ul — fetch-ul de mai jos NU
// verifică asta, doar redă ce găsește. Fix real: store Blob privat separat + `get()`/`copy()` din
// @vercel/blob în loc de `fetch()` brut. Vezi docs/BACKLOG.md.
export async function proxyBlobImage(url: string): Promise<NextResponse> {
  if (!isOwnBlobUrl(url)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Imagine indisponibilă." } },
      { status: 404 },
    );
  }
  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Imagine indisponibilă." } },
      { status: 404 },
    );
  }
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
