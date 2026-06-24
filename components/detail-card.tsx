// Card de detaliu în feed — layout orizontal: thumbnail (imaginea 2D) + conținut (titlu, text,
// autor+rol, stats, acțiuni). Pe mobil se așază pe verticală.
//
// Validarea „Aprob / Dezaprob" se face INLINE (FeedValidationActions, client): buton identic pentru toți,
// Dezaprob cere justificare obligatorie — aceeași regulă non-negociabilă enforce pe server ca pe pagina detaliului.
import Image from "next/image";
import Link from "next/link";

import type { ValidationPosition } from "@/server/domain/validation";
import type { FeedItem } from "@/server/repos/detailsRepo";

import { FeedValidationActions } from "./feed-validation-actions";
import { RolePill } from "./role-pill";

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function DetailCard({
  detail,
  myPosition,
}: {
  detail: FeedItem;
  myPosition: ValidationPosition | null;
}) {
  const href = `/details/${detail.id}`;

  return (
    <article className="flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10 sm:flex-row">
      {/* Thumbnail — imaginea 2D a detaliului, cu eticheta de categorie peste. */}
      <Link
        href={href}
        className="relative block aspect-[4/3] w-full shrink-0 border-b border-border bg-secondary sm:aspect-auto sm:w-[200px] sm:border-b-0 sm:border-r"
      >
        <Image
          src={detail.imageUrl}
          alt={detail.title}
          fill
          sizes="(max-width: 640px) 100vw, 200px"
          className="object-cover"
        />
        {detail.categoryName && (
          <span className="absolute left-2.5 top-2.5 rounded-md border border-border bg-background/85 px-1.5 py-1 font-mono text-[10px] uppercase tracking-wide text-primary">
            {detail.categoryName}
          </span>
        )}
      </Link>

      {/* Conținut. */}
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <Link href={href} className="no-underline">
          <h3 className="mb-1 font-bold leading-snug text-foreground hover:underline">
            {detail.title}
          </h3>
        </Link>
        {detail.description && (
          <p className="mb-3.5 line-clamp-2 text-sm text-muted-foreground">{detail.description}</p>
        )}

        {/* Autor + rol. */}
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-mono text-[11px] text-muted-foreground">
            {detail.authorImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.authorImage} alt="" className="size-full object-cover" />
            ) : (
              initials(detail.authorName)
            )}
          </span>
          <span className="text-sm font-semibold text-foreground">
            {detail.authorName ?? "Anonim"}
          </span>
          <RolePill
            roleMain={detail.authorRoleMain}
            verified={detail.authorVerification === "VERIFIED"}
          />
        </div>

        {/* Stats. */}
        <div className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11.5px] text-muted-foreground">
          <span>{detail.validationCount} validări</span>
          <span className="text-border">·</span>
          <span>{detail.commentCount} comentarii</span>
          <span className="text-border">·</span>
          <span>{detail.sketchCount} schițe în teanc</span>
        </div>

        {/* Acțiuni — validare inline pe roluri (Aprob 1-click / Dezaprob cu justificare). */}
        <FeedValidationActions detailId={detail.id} myPosition={myPosition} />
      </div>
    </article>
  );
}
