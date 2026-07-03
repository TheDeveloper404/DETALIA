"use client";

import { Activity, Pencil, Snowflake, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { RolePill } from "@/components/role-pill";
import { SketchViewer } from "@/components/sketch/sketch-viewer";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Stroke } from "@/server/domain/sketch";
import type { ValidationPosition } from "@/server/domain/validation";
import type { TargetComment } from "@/server/repos/commentsRepo";
import type { TargetPosition } from "@/server/repos/validationsRepo";

import { CommentsSection, type MentionSketch } from "./comments-section";
import { DetailActionsMenu } from "./detail-actions-menu";
import { deleteSketchAction, startSketchAction } from "./sketch-review-actions";
import { ValidationPanel } from "./validation-panel";

// Antetul detaliului (titlu/autor/params/descriere) — mutat în capul cardului workspace (model 3.jpeg).
export type DetailHeader = {
  title: string;
  description: string | null;
  createdAt: Date;
  categories: { id: string; name: string }[];
  climateZone: string | null;
  seismicAg: string;
  seismicTc: string;
  snowLoad: string;
  windLoad: string;
  isSaved: boolean;
};

export type ValidationView = {
  counts: { approve: number; disapprove: number };
  myPosition: ValidationPosition | null;
  positions: TargetPosition[];
};

// Autorul unei ținte (detaliu sau schiță) — pt panoul din dreapta.
type Author = {
  id: string | null;
  name: string | null;
  image: string | null;
  roleMain: string | null;
  subRole: string | null;
  verification: string | null;
};

// O schiță din teanc, cu validarea ei (comentariile NU mai sunt per-schiță — dezbaterea e unificată).
export type WorkspaceSketch = {
  id: string;
  author: Author;
  strokes: Stroke[];
  validation: ValidationView;
};

// Workspace unificat cu taburi (model „GitHub PR"): tab 0 = detaliul de bază, tab i = schiță peste mamă.
// Validarea e CONTEXTUALĂ pe tabul activ (per-țintă, model neschimbat). Dezbaterea e UN SINGUR fir pe
// toată postarea (target DETAIL), cu @mention care sare la tabul unei schițe. Comutarea de tab e pur
// client (toate view-urile vin precomputate din server) — mutațiile revalidează pagina ca înainte.
export function DetailWorkspace({
  detailId,
  imageUrl,
  header,
  detailAuthor,
  detailValidation,
  isDetailAuthor,
  sketches,
  comments,
  currentUserId,
  currentUserName,
  currentUserImage,
}: {
  detailId: string;
  imageUrl: string;
  header: DetailHeader;
  detailAuthor: Author;
  detailValidation: ValidationView;
  isDetailAuthor: boolean;
  sketches: WorkspaceSketch[];
  comments: TargetComment[];
  currentUserId?: string | null;
  currentUserName?: string | null;
  currentUserImage?: string | null;
}) {
  // 0 = detaliul de bază; 1..N = schițele (index i → sketches[i-1]). După o ștergere lista se scurtează
  // → clamp pe un tab valid.
  const [tab, setTab] = useState(0);
  const safeTab = Math.min(tab, sketches.length); // max = N (ultima schiță)
  const isBase = safeTab === 0;
  const activeSketch = isBase ? null : sketches[safeTab - 1];

  // Mențiunile din comentarii selectează un tab de schiță după id.
  function selectSketch(sketchId: string) {
    const idx = sketches.findIndex((s) => s.id === sketchId);
    if (idx >= 0) setTab(idx + 1);
  }

  const mentionSketches: MentionSketch[] = sketches.map((s) => ({
    id: s.id,
    authorName: s.author.name,
    authorImage: s.author.image,
  }));

  const activeAuthor = isBase ? detailAuthor : activeSketch!.author;
  const activeValidation = isBase ? detailValidation : activeSketch!.validation;
  // Nu-ți poți valida propriul conținut: pe detaliu = ești autorul-mamă; pe schiță = ești autorul schiței.
  const canValidate = isBase
    ? !isDetailAuthor
    : !!currentUserId && activeSketch!.author.id !== currentUserId;
  // Ștergerea schiței active: autorul detaliului (moderare) SAU autorul schiței.
  const canDeleteActive =
    !!activeSketch &&
    (isDetailAuthor || (!!currentUserId && activeSketch.author.id === currentUserId));

  const startSketchBtn = (
    <form action={startSketchAction}>
      <input type="hidden" name="detailId" value={detailId} />
      <Button type="submit" className="gap-2 shadow-md">
        <Pencil className="size-4" strokeWidth={2} />
        Schițează peste detaliu
      </Button>
    </form>
  );

  return (
    <div className="flex flex-col gap-7">
      {/* id=schiteaza — ținta scurtăturii „Schițează peste" din cardul de feed. */}
      <section id="schiteaza" className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card">
        {/* ANTET detaliu (titlu/autor/params/descriere) în capul cardului + „Schițează peste" sus-dreapta */}
        <div className="border-b border-[#eee6da] px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-heading text-[28px] font-extrabold leading-[1.15] tracking-tight text-balance">
              {header.title}
            </h1>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <AvatarInitials name={detailAuthor.name} imageUrl={detailAuthor.image} size={38} />
            <span className="font-heading text-[15.5px] font-bold">{detailAuthor.name ?? "Anonim"}</span>
            <RolePill
              roleMain={detailAuthor.roleMain}
              subRole={detailAuthor.subRole}
              verified={detailAuthor.verification === "VERIFIED"}
            />
            {header.categories.map((c) => (
              <Link
                key={c.id}
                href={`/feed?cat=${c.id}`}
                className="rounded-md border border-[#ecdcc8] bg-[#f6ede4] px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-primary"
              >
                {c.name}
              </Link>
            ))}
            <span className="font-mono text-xs text-muted-foreground">
              · publicat {formatDate(header.createdAt)}
            </span>
            <span className="ml-auto">
              <DetailActionsMenu
                detailId={detailId}
                authorId={detailAuthor.id ?? ""}
                isAuthor={isDetailAuthor}
                isSaved={header.isSaved}
              />
            </span>
          </div>

          {/* parametri tehnici */}
          {(header.climateZone ||
            header.seismicAg !== "General" ||
            header.seismicTc !== "General" ||
            header.snowLoad !== "General" ||
            header.windLoad !== "General") && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {header.climateZone && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  <Snowflake className="size-3 text-[#5e6f8a]" strokeWidth={2} />
                  {header.climateZone}
                </span>
              )}
              {(header.seismicAg !== "General" || header.seismicTc !== "General") && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  <Activity className="size-3 text-primary" strokeWidth={2} />
                  Seismic a_g {header.seismicAg} · Tc {header.seismicTc}
                </span>
              )}
              {header.snowLoad !== "General" && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  Încărcare zăpadă {header.snowLoad}
                </span>
              )}
              {header.windLoad !== "General" && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  Încărcare vânt {header.windLoad}
                </span>
              )}
            </div>
          )}

          {header.description && (
            <div className="mt-4 whitespace-pre-wrap text-[15.5px] leading-relaxed text-foreground/80 text-pretty">
              {header.description}
            </div>
          )}
        </div>

        {/* strip taburi: [DETALIU DE BAZĂ] + avatar-only per schiță (activ = avatar+nume, tooltip la hover) */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 sm:px-5">
          <button
            type="button"
            onClick={() => setTab(0)}
            title={detailAuthor.name ?? "Autor detaliu"}
            aria-label={detailAuthor.name ?? "Autor detaliu"}
            aria-current={isBase ? "true" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full transition-all",
              isBase
                ? "bg-secondary py-1 pl-1 pr-3 ring-1 ring-primary/30"
                : "p-0.5 opacity-70 hover:opacity-100",
            )}
          >
            <AvatarInitials
              name={detailAuthor.name}
              imageUrl={detailAuthor.image}
              size={28}
              className={cn("ring-2 transition-colors", isBase ? "ring-primary" : "ring-transparent")}
            />
            {isBase && (
              <span className="flex flex-col items-start leading-tight">
                <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                  Autor detaliu
                </span>
                <span className="font-heading text-[13px] font-semibold text-foreground">
                  {detailAuthor.name ?? "Anonim"}
                </span>
              </span>
            )}
          </button>
          {sketches.map((s, i) => {
            const label = s.author.name ?? `Schiță ${i + 1}`;
            const isActive = safeTab === i + 1;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setTab(i + 1)}
                title={label}
                aria-label={label}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full transition-all",
                  isActive
                    ? "bg-secondary py-1 pl-1 pr-3 ring-1 ring-primary/30"
                    : "p-0.5 opacity-70 hover:opacity-100",
                )}
              >
                <AvatarInitials
                  name={s.author.name}
                  imageUrl={s.author.image}
                  size={28}
                  className={cn("ring-2 transition-colors", isActive ? "ring-primary" : "ring-transparent")}
                />
                {isActive && (
                  <span className="font-heading text-[13px] font-semibold text-foreground">{label}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* viewport (tabul activ) + panou dreapta (autorul tabului activ) */}
        <div className="mt-3 grid grid-cols-1 border-t border-[#eee6da] md:grid-cols-[1fr_248px]">
          <div className="relative flex min-h-[300px] items-center justify-center border-b border-[#eee6da] bg-[#faf7f1] p-6 md:border-b-0 md:border-r">
            {/* CTA principal — cât mai la vedere, chiar în fereastra cu imaginea (nu lângă ea) */}
            <div className="absolute right-3 top-3 z-[3]">{startSketchBtn}</div>
            {isBase ? (
              <>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-50"
                  style={{
                    backgroundImage:
                      "linear-gradient(#ece1cd 1px,transparent 1px),linear-gradient(90deg,#ece1cd 1px,transparent 1px)",
                    backgroundSize: "28px 28px",
                  }}
                />
                <div className="relative z-[1] aspect-[4/3] w-full max-w-xl">
                  <Image
                    src={imageUrl}
                    alt={header.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    className="object-contain"
                    priority
                  />
                </div>
              </>
            ) : (
              <>
                <span className="absolute left-3 top-3 z-[2] rounded-md border border-[#e6dccd] bg-white/85 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-[#7c7060]">
                  schiță peste detaliu
                </span>
                <div className="w-full max-w-xl">
                  <SketchViewer imageUrl={imageUrl} strokes={activeSketch!.strokes} />
                </div>
              </>
            )}
          </div>

          {/* panou dreapta: autorul tabului activ + (schiță) badge + ștergere */}
          <div className="flex flex-col gap-4 p-5">
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#a59a88]">
                {isBase ? "Autor detaliu" : "Autor schiță"}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AvatarInitials name={activeAuthor.name} imageUrl={activeAuthor.image} size={30} />
                <span className="text-sm font-semibold">{activeAuthor.name ?? "Anonim"}</span>
              </div>
              <div className="mt-2">
                <RolePill
                  roleMain={activeAuthor.roleMain}
                  subRole={activeAuthor.subRole}
                  verified={activeAuthor.verification === "VERIFIED"}
                />
              </div>
            </div>

            {!isBase && (
              <span className="self-start rounded-full border border-emerald-600/30 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] text-emerald-700">
                în teanc · publicată
              </span>
            )}

            {canDeleteActive && activeSketch && (
              <form
                action={deleteSketchAction}
                onSubmit={(e) => {
                  if (
                    !window.confirm(
                      "Sigur ștergi această schiță? Validările și comentariile ei se șterg definitiv.",
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
                className="border-t border-[#eee6da] pt-3"
              >
                <input type="hidden" name="sketchId" value={activeSketch.id} />
                <input type="hidden" name="detailId" value={detailId} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#e6c9c4] bg-white px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-[#b0463c] transition-colors hover:bg-[#fbf1ef]"
                >
                  <Trash2 className="size-3.5" strokeWidth={2} />
                  {isDetailAuthor && activeSketch.author.id !== currentUserId
                    ? "Șterge schița"
                    : "Șterge schița mea"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* bara de validare CONTEXTUALĂ (pe ținta tabului activ), integrată în card (butoane compacte) */}
        <div className="border-t border-[#eee6da] p-5 sm:px-6">
          <ValidationPanel
            key={isBase ? "DETAIL" : activeSketch!.id}
            targetType={isBase ? "DETAIL" : "SKETCH"}
            targetId={isBase ? detailId : activeSketch!.id}
            detailId={detailId}
            allowSketch={isBase}
            canValidate={canValidate}
            counts={activeValidation.counts}
            myPosition={activeValidation.myPosition}
            positions={activeValidation.positions}
            embedded
          />
        </div>
      </section>

      {/* dezbaterea unificată pe toată postarea (target DETAIL) + @mention care sare la tabul schiței */}
      <CommentsSection
        targetType="DETAIL"
        targetId={detailId}
        detailId={detailId}
        comments={comments}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserImage={currentUserImage}
        mentionSketches={mentionSketches}
        onSelectSketch={selectSketch}
      />
    </div>
  );
}
