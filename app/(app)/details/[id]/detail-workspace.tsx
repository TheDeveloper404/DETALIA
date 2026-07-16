"use client";

import { Activity, Pencil, Snowflake } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import type { SupplierOfferRow } from "@/server/repos/supplierOffersRepo";
import type { TargetPosition } from "@/server/repos/validationsRepo";


import { CommentsSection, type MentionSketch } from "./comments-section";
import { DetailActionsMenu } from "./detail-actions-menu";
import { startSketchAction } from "./sketch-review-actions";
import { SupplierOfferPanel } from "./supplier-offer-panel";
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
  // Explicație în cuvinte a autorului, SEPARATĂ de desen (2026-07-16) — vezi sketch-editor.tsx.
  note: string | null;
  validation: ValidationView;
  // Ordinalul „schița N" trebuie să fie STABIL în timp (prima creată = 1, mereu) — vezi comentariul de
  // la calculul `label` mai jos. Nu confunda cu ordinea de afișare a taburilor (cea mai nouă primă).
  createdAt: Date;
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
  isCurrentUserFurnizor = false,
  isOfferingSupplier = false,
  supplierOffers,
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
  isCurrentUserFurnizor?: boolean; // doar afișare condiționată — gating real e pe server
  isOfferingSupplier?: boolean;
  supplierOffers: SupplierOfferRow[];
}) {
  // 0 = detaliul de bază; 1..N = schițele (index i → sketches[i-1]). După o ștergere lista se scurtează
  // → clamp pe un tab valid. `?sketch=<id>` din URL (dacă e prezent) deschide direct pe tab-ul acela.
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [tab, setTab] = useState(() => {
    const wanted = searchParams.get("sketch");
    if (!wanted) return 0;
    const idx = sketches.findIndex((s) => s.id === wanted);
    return idx >= 0 ? idx + 1 : 0;
  });
  const safeTab = Math.min(tab, sketches.length); // max = N (ultima schiță)
  const isBase = safeTab === 0;
  const activeSketch = isBase ? null : sketches[safeTab - 1];

  // Sincronizează URL-ul cu tab-ul activ (shallow, fără reload) — altfel bara de adresă a browserului nu
  // reflectă schița deschisă, iar „copiază link-ul din browser" (regula 2026-07-06: fără buton dedicat de
  // link privat) ar trimite mereu pe tab de bază, nu pe schița pe care o vezi.
  function setTabAndUrl(next: number) {
    setTab(next);
    const sketchId = next === 0 ? null : sketches[next - 1]?.id;
    router.replace(sketchId ? `${pathname}?sketch=${sketchId}` : pathname, { scroll: false });
  }

  // Mențiunile din comentarii selectează un tab de schiță după id.
  function selectSketch(sketchId: string) {
    const idx = sketches.findIndex((s) => s.id === sketchId);
    if (idx >= 0) setTabAndUrl(idx + 1);
  }

  const mentionSketches: MentionSketch[] = sketches.map((s) => ({
    id: s.id,
    authorName: s.author.name,
    authorImage: s.author.image,
    createdAt: s.createdAt,
  }));

  const activeValidation = isBase ? detailValidation : activeSketch!.validation;
  // Nu-ți poți valida propriul conținut: pe detaliu = ești autorul-mamă; pe schiță = ești autorul schiței.
  const canValidate = isBase
    ? !isDetailAuthor
    : !!currentUserId && activeSketch!.author.id !== currentUserId;
  // Ștergerea schiței active: autorul detaliului (moderare) SAU autorul schiței.
  const canDeleteActive =
    !!activeSketch &&
    (isDetailAuthor || (!!currentUserId && activeSketch.author.id === currentUserId));

  // Mutat sub imagine (nu mai suprapus peste ea) + colaps la iconiță — textul apare doar la HOVER
  // (mouse peste buton), nu la click (spre deosebire de taburile de mai sus, care se extind la click).
  const startSketchBtn = (
    <form action={startSketchAction}>
      <input type="hidden" name="detailId" value={detailId} />
      <Button
        type="submit"
        size="icon"
        title="Schițează peste detaliu"
        className="group/button !w-auto gap-0 overflow-hidden !px-2.5 shadow-md"
      >
        <Pencil className="size-4 shrink-0" strokeWidth={2} />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/button:ml-2 group-hover/button:max-w-[220px] group-hover/button:opacity-100">
          Schițează peste detaliu
        </span>
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
            <Link
              href={`/profile/${detailAuthor.id}`}
              className="flex items-center gap-2 no-underline"
            >
              <AvatarInitials name={detailAuthor.name} imageUrl={detailAuthor.image} size={38} />
              <span className="font-heading text-[15.5px] font-bold hover:underline">
                {detailAuthor.name ?? "Anonim"}
              </span>
            </Link>
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
                isAuthor={isDetailAuthor}
                isSaved={header.isSaved}
                canSendToCanvas={!!currentUserId}
                activeSketchPublicId={isBase ? null : activeSketch!.id}
                canDeleteActiveSketch={canDeleteActive}
                deleteSketchLabel={
                  !isBase && isDetailAuthor && activeSketch!.author.id !== currentUserId
                    ? "Șterge schița"
                    : "Șterge schița mea"
                }
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

        {/* strip taburi: [DETALIU DE BAZĂ] + avatar-only per schiță (activ = avatar+nume, tooltip la hover).
            Anti-tremur: min-h FIX (înălțimea rândului nu fluctuează cu starea pastilelor) + flex-NOWRAP
            (lărgirea pastilei active nu poate împinge pastilele pe rândul doi → fără salt de ~40px sub ele;
            la overflow se face scroll orizontal, nu wrap). */}
        {/* pb: „overflow-x-auto" transformă rândul într-un container de scroll pe ambele axe (per spec CSS,
            overflow-x != visible face overflow-y „auto" implicit) → fără padding jos, inelul avatarului
            (box-shadow) și descendentele literelor (ș/ț) se tăiau la marginea de jos. */}
        <div className="flex min-h-11 flex-nowrap items-center gap-1.5 overflow-x-auto px-4 pb-1.5 pt-3 sm:px-5">
          <button
            type="button"
            onClick={() => setTabAndUrl(0)}
            title={detailAuthor.name ?? "Autor detaliu"}
            aria-label={detailAuthor.name ?? "Autor detaliu"}
            aria-current={isBase ? "true" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full transition-colors",
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
            // Autor cu mai multe schițe → eticheta primește ordinalul („Nume — schița 2"), IDENTIC cu
            // eticheta mențiunilor din dezbatere (comments-section) — cititorul le poate corela.
            // Ordinalul e după data creării (prima schiță = 1, FIX, nu se renumerotează niciodată) — NU
            // după ordinea din `sketches` (cea mai nouă primă, doar pt afișarea taburilor). Altfel, la
            // fiecare schiță nouă a aceluiași autor, toate etichetele mai vechi s-ar renumerota (bug
            // raportat de Liviu 2026-07-07: schița de azi devenea „1", cea de ieri „2").
            const baseName = s.author.name ?? "Anonim";
            const sameAuthor = sketches
              .filter((x) => (x.author.name ?? "") === (s.author.name ?? ""))
              .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            const label =
              sameAuthor.length > 1
                ? `${baseName} — schița ${sameAuthor.findIndex((x) => x.id === s.id) + 1}`
                : baseName;
            const isActive = safeTab === i + 1;
            return (
              <button
                key={s.id}
                type="button"
                data-testid={`sketch-tab-${s.id}`}
                onClick={() => setTabAndUrl(i + 1)}
                title={label}
                aria-label={label}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full transition-colors",
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
                  <span className="flex items-center gap-2">
                    <span className="font-heading text-[13px] font-semibold text-foreground">{label}</span>
                    <RolePill
                      roleMain={s.author.roleMain}
                      subRole={s.author.subRole}
                      verified={s.author.verification === "VERIFIED"}
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* viewport (tabul activ) — panoul separat din dreapta a fost scos 2026-07-06: autorul + rolul
            erau deja afișate în antet (tab bază) / lângă tab-ul activ (tab schiță, RolePill de mai sus);
            singura info netă din panou era rolul, mutat acolo. Imaginea folosește acum toată lățimea. */}
        <div className="mt-3 border-t border-[#eee6da]">
          <div className="relative flex min-h-[420px] items-center justify-center bg-[#faf7f1] p-6">
            {/* CTA suprapus peste imagine, colț dreapta-jos (nu bară separată). */}
            <div className="absolute bottom-3 right-3 z-[3]">{startSketchBtn}</div>
            {/* grilă + cutie 4/3 IDENTICE pe ambele taburi — altfel viewport-ul „sare" la comutare */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "linear-gradient(#ece1cd 1px,transparent 1px),linear-gradient(90deg,#ece1cd 1px,transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            {!isBase && (
              <span
                key={`badge-${safeTab}`}
                className="absolute left-3 top-3 z-[2] animate-in fade-in rounded-md border border-[#e6dccd] bg-white/85 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-[#7c7060] duration-200"
              >
                schiță peste detaliu
              </span>
            )}
            <div className="relative z-[1] aspect-[4/3] w-full max-w-3xl">
              {/* imaginea-mamă rămâne PERMANENT montată (nu se remontează la comutarea taburilor —
                  altfel reîncărca async și „pocnea") ȘI mereu OPACĂ (2026-07-16, cerere Edi — detaliul
                  de bază nu se mai face transparent; schița e cea cu foaia semitransparentă, randată de
                  SketchViewer peste el, ca în realitate). Doar overlay-ul de schiță face fade-in la
                  comutare (opacity, FĂRĂ animație de layout — nu redeschide problema tremurului). */}
              <Image
                src={imageUrl}
                alt={header.title}
                fill
                sizes="(max-width: 1024px) 100vw, 768px"
                className="object-contain"
                priority
              />
              {!isBase && (
                <div key={`sketch-${safeTab}`} className="absolute inset-0 animate-in fade-in duration-200">
                  <SketchViewer imageUrl={imageUrl} strokes={activeSketch!.strokes} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Explicația autorului schiței, în cuvinte — SEPARATĂ de desen (2026-07-16). Doar pe tab de
            schiță, doar dacă autorul a scris ceva. */}
        {!isBase && activeSketch!.note && (
          <div
            key={`note-${activeSketch!.id}`}
            className="animate-in fade-in border-t border-[#eee6da] bg-[#faf7f1] px-5 py-4 duration-200 sm:px-6"
          >
            <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
              Explicația autorului
            </div>
            <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground">
              {activeSketch!.note}
            </p>
          </div>
        )}

        {/* bara de validare CONTEXTUALĂ (pe ținta tabului activ), integrată în card (butoane compacte);
            fade-in la comutare (opacity, fără animație de layout — nu redeschide tremurul) */}
        <div
          key={isBase ? "DETAIL" : activeSketch!.id}
          className="animate-in fade-in border-t border-[#eee6da] p-5 duration-200 sm:px-6"
        >
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
          {isBase && (
            <SupplierOfferPanel
              detailId={detailId}
              isFurnizor={!isDetailAuthor && isCurrentUserFurnizor}
              isOffering={isOfferingSupplier}
              offers={supplierOffers}
            />
          )}
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
