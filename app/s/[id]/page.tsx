import { ImageOff } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { RolePill } from "@/components/role-pill";
import { getPublicSketch } from "@/server/services/sketchService";

// Pagină PUBLICĂ (fără cont) pt o schiță anume — teaser READ-ONLY (decizie confirmată 2026-07-05,
// vezi handoff). Randăm DOAR imaginea deja compusă la publicare (`thumbnailUrl` — detaliul-mamă +
// stroke-urile suprapuse), fără zoom/pan/interacțiune și fără strokesJson brut (nu expunem date
// vectoriale unui vizitator anonim). Teancul/celelalte schițe NU sunt accesibile de aici — doar CTA
// spre autentificare. `getPublicSketch` întoarce null uniform (șters/DRAFT/inexistent) → 404, fără
// să distingem cauza (anti-enumerare, consistent cu restul platformei).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const sketch = await getPublicSketch(id);
  if (!sketch) return { title: "Schiță indisponibilă — DETALIA" };
  return {
    title: `Schiță peste „${sketch.detailTitle}” — DETALIA`,
    description: `O schiță de ${sketch.authorName ?? "un membru al comunității"} peste „${sketch.detailTitle}”, pe DETALIA.`,
  };
}

export default async function PublicSketchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sketch = await getPublicSketch(id);
  if (!sketch) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex h-[76px] flex-none items-center border-b border-border bg-secondary/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[var(--container-max)] items-center justify-between px-6">
          <BrandLogo size={32} />
          <div className="flex items-center gap-5">
            <Link
              href="/login"
              className="text-[15px] font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
            >
              Autentifică-te
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center rounded-lg border border-[#95492e] bg-primary px-4 py-2 text-[14px] font-semibold text-primary-foreground no-underline transition-colors hover:bg-[#974a2e]"
            >
              Creează cont
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-6 py-12">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-primary">Schiță · DETALIA</p>
        <h1 className="mb-5 font-heading text-[26px] font-bold leading-tight tracking-tight">
          Schiță peste „{sketch.detailTitle}”
        </h1>

        <div className="mb-5 flex items-center gap-2.5">
          <span className="text-[15px] font-semibold">{sketch.authorName ?? "Anonim"}</span>
          <RolePill
            roleMain={sketch.authorRoleMain}
            subRole={sketch.authorSubRole}
            verified={sketch.authorVerification === "VERIFIED"}
          />
        </div>

        <div className="relative mb-8 aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-secondary">
          {sketch.thumbnailUrl ? (
            <Image
              src={sketch.thumbnailUrl}
              alt={`Schiță peste „${sketch.detailTitle}”`}
              fill
              sizes="720px"
              className="object-contain"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageOff className="size-8" strokeWidth={1.5} />
              <span className="text-sm">Imaginea nu e disponibilă</span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-8 text-center">
          <p className="mb-4 leading-relaxed text-muted-foreground">
            Creează un cont gratuit ca să vezi dezbaterea completă, teancul de schițe și să validezi pe
            rolul tău.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center rounded-lg border border-[#95492e] bg-primary px-[22px] py-2.5 font-semibold text-primary-foreground no-underline transition-colors hover:bg-[#974a2e]"
          >
            Creează cont gratuit
          </Link>
        </div>
      </main>
    </div>
  );
}
