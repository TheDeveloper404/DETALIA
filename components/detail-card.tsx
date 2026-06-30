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
            initials(v.name)
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
}: {
  detail: FeedItem;
  myPosition: ValidationPosition | null;
  currentUserId?: string | null;
}) {
  const href = `/details/${detail.id}`;
  // Autorul propriului detaliu nu se validează pe sine → ascundem butoanele (enforce și pe server).
  const canValidate = !currentUserId || detail.authorId !== currentUserId;

  return (
    <article className="flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10 sm:flex-row">
      {/* Thumbnail — imaginea 2D a detaliului, cu eticheta de categorie peste. */}
      <Link
        href={href}
        className="relative block aspect-[4/3] w-full shrink-0 self-stretch border-b border-border bg-secondary sm:w-[200px] sm:self-start sm:border-b-0 sm:border-r"
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

        {/* Acțiuni — validare inline pe roluri (Aprob 1-click / Dezaprob cu justificare). Ascunse pe propriul detaliu. */}
        {canValidate && <FeedValidationActions detailId={detail.id} myPosition={myPosition} />}
      </div>
    </article>
  );
}
