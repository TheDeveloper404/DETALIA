"use client";

// Card de detaliu în feed — layout orizontal: thumbnail (imaginea 2D) + conținut (titlu, text,
// autor+rol, stats, acțiuni). Pe mobil se așază pe verticală.
//
// Aprob/Dezaprob NU se dă din feed (2026-08-16, decizie de produs) — doar count-ul, informativ; votul
// real se dă de pe pagina detaliului, după ce ai citit explicația autorului. Count-ul afișat e TOTALUL
// (aprob + dezaprob), pe detaliu + schițe (2026-08-27) — reflectă dezbaterea, nu doar pozițiile pro.
import { Eye, Layers, MessageSquare, Scale } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { FeedItem } from "@/server/repos/detailsRepo";
import { blobReadUrl } from "@/lib/blob-read-url";

import { FeedSaveButton } from "./feed-save-button";
import { HighlightedText } from "./highlighted-text";
import { PersonSilhouette } from "./avatar-initials";
import { PublishedTime } from "./published-time";
import { RolePill } from "./role-pill";

// Stivă de avatare — cercuri suprapuse cu cine s-a implicat pe detaliu (orice interacțiune: poziție,
// comentariu, schiță — o poză per user, dedus în `interactorAvatars`/`interactorCount` din repo).
// Aducem max 5 avatare din DB; dacă sunt mai mulți, ultimul cerc devine „+N".
function InteractorStack({
  avatars,
  total,
}: {
  avatars: { name: string | null; image: string | null }[];
  total: number;
}) {
  // Rezervăm întotdeauna înălțimea rândului (h-6 = dimensiunea avatarului) ca să nu „crească"
  // cardul când treci de la 0 la ≥1 interacțiune.
  if (total <= 0 || avatars.length === 0) return <div className="mb-3 h-6" aria-hidden />;
  const overflow = total - avatars.length;

  return (
    <div className="mb-3 flex h-6 items-center">
      {avatars.map((v, i) => (
        <span
          key={i}
          title={v.name ?? "A interacționat"}
          className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-secondary font-mono text-[9px] text-muted-foreground ring-2 ring-card first:ml-0 -ml-2"
        >
          {v.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.image} alt="" className="size-full object-cover" />
          ) : (
            <PersonSilhouette className="size-3.5" />
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span className="-ml-2 flex size-6 items-center justify-center rounded-full bg-secondary font-mono text-[9px] font-semibold text-muted-foreground ring-2 ring-card">
          +{overflow}
        </span>
      )}
    </div>
  );
}

export function DetailCard({
  detail,
  currentUserId,
  isSaved = false,
  searchQuery,
  tourAnchor = false,
  sketchPreviews = [],
}: {
  detail: FeedItem;
  currentUserId?: string | null;
  isSaved?: boolean;
  // Termenul din `?q=` — dacă e dat, titlul/descriere apar cu porțiunea potrivită evidențiată.
  searchQuery?: string | null;
  // Doar pe primul card din feed: ținta pasului „ce poți face pe un detaliu" din turul ghidat.
  tourAnchor?: boolean;
  sketchPreviews?: { id: string; thumbnailUrl: string }[];
}) {
  const href = `/details/${detail.id}`;
  const [hovered, setHovered] = useState(false);
  const [frame, setFrame] = useState(0);
  // Fara tranzitie la saltul de pe copia bazei inapoi pe baza (arata identic, deci nu se vede).
  const [instant, setInstant] = useState(false);
  // Miniaturile se monteaza la primul hover, ca feed-ul sa nu le incarce la deschidere.
  const [primed, setPrimed] = useState(false);
  // Feed-ul arată DOAR detalii PUBLISHED (listFeed) → imageUrl mereu setat (DRAFT nu ajunge aici).
  const baseUrl = blobReadUrl(detail.imageUrl!, "detail", detail.id);
  // Banda [baza, ...schite, baza]: copia de la final tine loop-ul mereu spre stanga.
  const slides = primed && sketchPreviews.length > 0
    ? [baseUrl, ...sketchPreviews.map((preview) => blobReadUrl(preview.thumbnailUrl, "sketch", preview.id)), baseUrl]
    : [baseUrl];
  const last = slides.length - 1;
  useEffect(() => {
    if (!hovered || last === 0) return;
    const timer = setInterval(() => {
      setInstant(false);
      setFrame((current) => Math.min(current + 1, last));
    }, 1500);
    return () => clearInterval(timer);
  }, [hovered, last]);

  return (
    <article
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setPrimed(true);
          setHovered(true);
        }
      }}
      onPointerLeave={() => { setHovered(false); setInstant(frame === last); setFrame(0); }}
      data-tour={tourAnchor ? "feed-first-card" : undefined}
      className="flex flex-col rounded-lg bg-card ring-1 ring-foreground/10 sm:min-h-[220px] sm:flex-row"
    >
      {/* Thumbnail — imaginea 2D a detaliului, cu eticheta de categorie peste. */}
      <div className="relative aspect-[4/3] w-full shrink-0 self-stretch overflow-hidden rounded-t-lg border-b border-border bg-secondary sm:w-[260px] sm:rounded-l-lg sm:rounded-tr-none sm:border-b-0 sm:border-r">
        <Link href={href} className="block size-full">
          <div
            className={`flex size-full ${instant ? "transition-none" : "transition-transform duration-500 ease-out"}`}
            style={{ transform: `translateX(-${frame * 100}%)` }}
            onTransitionEnd={() => {
              if (frame > 0 && frame === last) { setInstant(true); setFrame(0); }
            }}
          >
            {slides.map((src, index) => (
              <div key={index} className="relative size-full shrink-0" aria-hidden={index > 0 || undefined}>
                <Image
                  src={src}
                  unoptimized={src.startsWith("/api/files/")}
                  // In afara cadrului pana gliseaza: lazy le-ar incarca abia in timpul glisarii.
                  loading={index > 0 ? "eager" : undefined}
                  onError={() => { setHovered(false); setInstant(true); setFrame(0); }}
                  alt={index === 0 ? detail.title : ""}
                  fill
                  sizes="(max-width: 640px) 100vw, 260px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
          {detail.categories.length > 0 && (
            <span className="absolute left-2.5 top-2.5 rounded-md border border-border bg-background/85 px-1.5 py-1 font-mono text-[10px] uppercase tracking-wide text-primary">
              {detail.categories[0].name}
              {detail.categories.length > 1 && ` +${detail.categories.length - 1}`}
            </span>
          )}
        </Link>
      </div>

      {/* Conținut — bookmark „Salvează" în colțul dreapta-sus al acestui container (nu peste desen). */}
      <div className="relative flex min-w-0 flex-1 flex-col p-5">
        {currentUserId && <FeedSaveButton detailId={detail.id} isSaved={isSaved} />}
        <Link href={href} className="no-underline">
          <h3 className="mb-1 pr-8 font-bold leading-snug text-foreground hover:underline">
            <HighlightedText text={detail.title} query={searchQuery} />
          </h3>
        </Link>
        {detail.description && (
          <p className="mb-3.5 line-clamp-2 text-sm text-muted-foreground">
            <HighlightedText text={detail.description} query={searchQuery} />
          </p>
        )}

        {/* Autor + rol. Autorul retras (anonimizat) NU are nume, poză sau link de profil — doar rolul,
            din snapshot-ul înghețat la retragere; identitatea nici nu ajunge de pe server (vezi
            `detailWithAuthorColumns`). */}
        {/* FĂRĂ flex-wrap (2026-08-17): un rol lung (ex. „Inginer instalații termice/HVAC") împingea
            pastila pe rândul 2 — acum numele se trunchiază cu elipsă la nevoie, pastila rămâne mereu
            pe același rând, `shrink-0`. */}
        <div className="mb-3 flex min-w-0 items-center gap-2.5">
          {detail.isAnonymized ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-mono text-[11px] text-muted-foreground">
                <PersonSilhouette className="size-4" />
              </span>
              <span className="truncate text-sm font-semibold text-muted-foreground">Anonim</span>
            </span>
          ) : (
          <Link
            href={`/profile/${detail.authorId}`}
            className="flex min-w-0 items-center gap-2.5 no-underline"
          >
            <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-mono text-[11px] text-muted-foreground">
              {detail.authorImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.authorImage} alt="" className="size-full object-cover" />
              ) : (
                <PersonSilhouette className="size-4" />
              )}
            </span>
            <span className="truncate text-sm font-semibold text-foreground hover:underline">
              {detail.authorName ?? "Anonim"}
            </span>
          </Link>
          )}
          <span className="shrink-0">
            <RolePill
              roleMain={detail.authorRoleMain}
              subRole={detail.authorSubRole}
              verified={detail.authorVerification === "VERIFIED"}
            />
          </span>
        </div>

        {/* Stivă de implicare — avatarele celor care au interacționat (poziție/comentariu/schiță),
            suprapuse, o poză per user. */}
        <InteractorStack avatars={detail.interactorAvatars} total={detail.interactorCount} />

        {/* Stats — lipit de marginea de jos a cardului (mt-auto absoarbe spațiul rămas). Stânga: acțiuni
            de interacțiune, în ordinea 1. validare 2. comentarii 3. schițe în teanc (2026-08-07).
            Dreapta: dată publicare + vizualizări (informativ, nu interacțiune). */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 font-mono text-[11.5px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {/* Fără vot inline (2026-08-16): aprob/dezaprob cere să deschizi detaliul — un vot dat doar
                din titlu+thumbnail, fără să citești explicația autorului, nu spune nimic despre
                calitate. Doar count-ul rămâne, informativ. `validationCount` = TOTALUL aprob+dezaprob,
                pe detaliu + schițe (2026-08-27, Liviu+Edi). Iconiță balanță (nu check/triunghi-sus —
                acelea sugerează vizual „doar pozitiv"; e un total al dezbaterii). */}
            <span className="inline-flex items-center gap-1" title="Validări (aprobări + dezaprobări)">
              <Scale className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="sr-only">validări:</span>
              {detail.validationCount}
            </span>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1" title="Comentarii">
              <MessageSquare className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="sr-only">comentarii:</span>
              {detail.commentCount}
            </span>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1" title="Schițe în teanc">
              <Layers className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="sr-only">schițe în teanc:</span>
              {detail.sketchCount}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <PublishedTime value={detail.createdAt} />
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1" title="Vizualizări">
              <Eye className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="sr-only">vizualizări:</span>
              {detail.views}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
