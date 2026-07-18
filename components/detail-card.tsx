// Card de detaliu în feed — layout orizontal: thumbnail (imaginea 2D) + conținut (titlu, text,
// autor+rol, stats, acțiuni). Pe mobil se așază pe verticală.
//
// Validarea „Aprob / Dezaprob" se face INLINE (FeedValidationActions, client): buton identic pentru toți,
// Dezaprob cere justificare obligatorie — aceeași regulă non-negociabilă enforce pe server ca pe pagina detaliului.
import { PencilRuler } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { ValidationPosition } from "@/server/domain/validation";
import type { FeedItem } from "@/server/repos/detailsRepo";

import { FeedSaveButton } from "./feed-save-button";
import { PersonSilhouette } from "./avatar-initials";
import { FeedValidationActions } from "./feed-validation-actions";
import { RolePill } from "./role-pill";
import { SendToCanvasButton } from "./send-to-canvas-button";

// Stivă de avatare ale validatorilor — cercuri suprapuse (cine a luat poziție pe detaliu).
// Aducem max 5 avatare din DB; dacă sunt mai mulți validatori, ultimul cerc devine „+N".
function ValidatorStack({
  avatars,
  total,
}: {
  avatars: { name: string | null; image: string | null }[];
  total: number;
}) {
  // Rezervăm întotdeauna înălțimea rândului (h-6 = dimensiunea avatarului) ca să nu „crească"
  // cardul când treci de la 0 validări la ≥1 (după Aprob/Dezaprob).
  if (total <= 0 || avatars.length === 0) return <div className="mb-3 h-6" aria-hidden />;
  const overflow = total - avatars.length;

  return (
    <div className="mb-3 flex h-6 items-center">
      {avatars.map((v, i) => (
        <span
          key={i}
          title={v.name ?? "Validator"}
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
  myPosition,
  currentUserId,
  isSaved = false,
}: {
  detail: FeedItem;
  myPosition: ValidationPosition | null;
  currentUserId?: string | null;
  isSaved?: boolean;
}) {
  const href = `/details/${detail.id}`;
  // Autorul propriului detaliu nu se validează pe sine → ascundem butoanele (enforce și pe server).
  const canValidate = !currentUserId || detail.authorId !== currentUserId;

  return (
    <article className="flex flex-col rounded-lg bg-card ring-1 ring-foreground/10 sm:min-h-[220px] sm:flex-row">
      {/* Thumbnail — imaginea 2D a detaliului, cu eticheta de categorie peste. */}
      <div className="relative aspect-[4/3] w-full shrink-0 self-stretch overflow-hidden rounded-t-lg border-b border-border bg-secondary sm:w-[260px] sm:rounded-l-lg sm:rounded-tr-none sm:border-b-0 sm:border-r">
        <Link href={href} className="block size-full">
          <Image
            // Feed-ul arată DOAR detalii PUBLISHED (listFeed) → imageUrl mereu setat (DRAFT nu ajunge aici).
            src={detail.imageUrl!}
            alt={detail.title}
            fill
            sizes="(max-width: 640px) 100vw, 260px"
            className="object-cover"
          />
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
            {detail.title}
          </h3>
        </Link>
        {detail.description && (
          <p className="mb-3.5 line-clamp-2 text-sm text-muted-foreground">{detail.description}</p>
        )}

        {/* Autor + rol. */}
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <Link
            href={`/profile/${detail.authorId}`}
            className="flex items-center gap-2.5 no-underline"
          >
            <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-mono text-[11px] text-muted-foreground">
              {detail.authorImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.authorImage} alt="" className="size-full object-cover" />
              ) : (
                <PersonSilhouette className="size-4" />
              )}
            </span>
            <span className="text-sm font-semibold text-foreground hover:underline">
              {detail.authorName ?? "Anonim"}
            </span>
          </Link>
          <RolePill
            roleMain={detail.authorRoleMain}
            subRole={detail.authorSubRole}
            verified={detail.authorVerification === "VERIFIED"}
          />
        </div>

        {/* Stivă de validatori — avatarele celor care au luat poziție, suprapuse (cine a contribuit). */}
        <ValidatorStack avatars={detail.validatorAvatars} total={detail.validationCount} />

        {/* Stats. */}
        <div className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11.5px] text-muted-foreground">
          <span>{detail.validationCount} validări</span>
          <span className="text-border">·</span>
          <span>{detail.commentCount} comentarii</span>
          <span className="text-border">·</span>
          <span>{detail.sketchCount} schițe în teanc</span>
        </div>

        {/* Acțiuni — toate icon-only, text la HOVER (nu la click), un singur rând: validare (dacă e permisă)
            + „Schițează peste" + „Trimite în Planșă". Link secundar (NU buton) pt schițare: duce în pagina
            detaliului la teanc (context), fără să creeze draft. */}
        <div className="mt-auto flex flex-wrap items-center gap-3">
          {canValidate && <FeedValidationActions detailId={detail.id} myPosition={myPosition} />}
          {/* Tooltip absolut poziționat (NU expandare inline) — o etichetă care „împinge" vecinii la hover
              le mută poziția reală sub cursor, iar cursorul „ratează" iconița următoare la navigare rapidă
              (bug raportat de Liviu, 2026-07-06). Absolut = restul rândului nu se mișcă niciodată. */}
          <Link
            href={`${href}#schiteaza`}
            title="Schițează peste"
            className="group/schiteaza relative inline-flex items-center justify-center rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PencilRuler className="size-3.5 shrink-0" strokeWidth={2} />
            <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 font-mono text-[11px] text-background opacity-0 transition-opacity duration-150 group-hover/schiteaza:opacity-100">
              Schițează peste
            </span>
          </Link>
          {currentUserId && <SendToCanvasButton detailId={detail.id} />}
        </div>
      </div>
    </article>
  );
}
