"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { RolePill } from "@/components/role-pill";
import { SketchViewer } from "@/components/sketch/sketch-viewer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Stroke } from "@/server/domain/sketch";
import type { ValidationPosition } from "@/server/domain/validation";
import type { TargetComment } from "@/server/repos/commentsRepo";
import type { TargetPosition } from "@/server/repos/validationsRepo";

import { CommentsSection } from "./comments-section";
import { acceptSketchAction, rejectSketchAction, startSketchAction } from "./sketch-review-actions";
import { ValidationPanel } from "./validation-panel";

export type SketchItem = {
  id: string;
  authorName: string | null;
  authorImage: string | null;
  authorRoleMain: string | null;
  authorSubRole: string | null;
  authorVerification: string | null;
  strokes: Stroke[];
};

export type ValidationView = {
  counts: { approve: number; disapprove: number };
  myPosition: ValidationPosition | null;
  positions: TargetPosition[];
};

// Schiță publicată = + dezbaterea ei (validare + comentarii, polimorfic pe SKETCH).
export type PublishedSketchItem = SketchItem & {
  validation: ValidationView;
  comments: TargetComment[];
};

export function SketchSection({
  detailId,
  imageUrl,
  published,
  pending,
  currentUserId,
  currentUserName,
  currentUserImage,
}: {
  detailId: string;
  imageUrl: string;
  published: PublishedSketchItem[];
  pending: SketchItem[]; // gol dacă userul curent nu e autorul-mamă
  currentUserId?: string | null;
  currentUserName?: string | null;
  currentUserImage?: string | null;
}) {
  // 0..N-1 = schițele publicate (teancul).
  const [tab, setTab] = useState(0);
  const active = published[tab];

  const startSketchBtn = (
    <form action={startSketchAction}>
      <input type="hidden" name="detailId" value={detailId} />
      <Button type="submit" className="gap-2">
        <Pencil className="size-[15px]" strokeWidth={2} />
        Schițează peste detaliu
      </Button>
    </form>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eee6da] px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-heading text-lg font-bold">Teancul de schițe</h2>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              Propuneri desenate peste detaliul-mamă — fiecare cu validările ei.
            </p>
          </div>
          {published.length > 0 && startSketchBtn}
        </div>

        {published.length > 0 && active ? (
          <>
            {/* taburi (autorul fiecărei foi) */}
            <div className="flex flex-wrap gap-1 px-4 pt-3 sm:px-5">
              {published.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTab(i)}
                  className={cn(
                    "-mb-px border-b-2 px-3.5 py-2.5 font-heading text-[13.5px] font-semibold transition-colors",
                    tab === i
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.authorName ?? `Schiță ${i + 1}`}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 border-t border-[#eee6da] md:grid-cols-[1fr_248px]">
              {/* viewport */}
              <div className="relative flex min-h-[300px] items-center justify-center border-b border-[#eee6da] bg-[#faf7f1] p-6 md:border-b-0 md:border-r">
                <span className="absolute left-3 top-3 z-[2] rounded-md border border-[#e6dccd] bg-white/85 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-[#7c7060]">
                  schiță peste detaliul-mamă
                </span>
                <div className="w-full max-w-md">
                  <SketchViewer imageUrl={imageUrl} strokes={active.strokes} />
                </div>
              </div>

              {/* meta schiță activă */}
              <div className="flex flex-col gap-4 p-5">
                <div>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#a59a88]">
                    Autor schiță
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AvatarInitials name={active.authorName} imageUrl={active.authorImage} size={30} />
                    <span className="text-sm font-semibold">{active.authorName ?? "Anonim"}</span>
                  </div>
                  <div className="mt-2">
                    <RolePill
                      roleMain={active.authorRoleMain}
                      verified={active.authorVerification === "VERIFIED"}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-[#eee6da] pt-3 font-mono text-[11px] text-muted-foreground">
                  <span>{active.validation.counts.approve + active.validation.counts.disapprove} validări</span>
                  <span className="text-[#d6cdbd]">·</span>
                  <span>{active.comments.length} comentarii</span>
                </div>

                <span className="self-start rounded-full border border-emerald-600/30 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] text-emerald-700">
                  în teanc · publicată
                </span>
              </div>
            </div>

            {/* dezbaterea schiței active (polimorfic pe SKETCH) */}
            <div className="flex flex-col gap-5 border-t border-[#eee6da] p-5 sm:px-6">
              <ValidationPanel
                targetType="SKETCH"
                targetId={active.id}
                detailId={detailId}
                allowSketch={false}
                counts={active.validation.counts}
                myPosition={active.validation.myPosition}
                positions={active.validation.positions}
              />
              <CommentsSection
                targetType="SKETCH"
                targetId={active.id}
                detailId={detailId}
                comments={active.comments}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserImage={currentUserImage}
                title="Dezbatere pe schiță"
              />
            </div>
          </>
        ) : (
          /* empty state */
          <div className="flex flex-col items-center px-8 py-12 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-[14px] border border-[#e6ddcf] bg-secondary">
              <Pencil className="size-6 text-primary" strokeWidth={1.8} />
            </div>
            <h3 className="font-heading text-lg font-bold">Nicio schiță încă</h3>
            <p className="mx-auto mt-2 mb-5 max-w-[40ch] text-sm leading-relaxed text-muted-foreground">
              Fii primul care propune o variantă desenată peste acest detaliu. Schița ta intră în teanc
              și breasla o cântărește pe roluri.
            </p>
            {startSketchBtn}
          </div>
        )}
      </section>

      {/* Propuneri în așteptare — vizibile DOAR autorului detaliului-mamă (filtrat pe server). */}
      {pending.length > 0 && (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:px-6">
          <div>
            <h2 className="font-heading text-lg font-bold">
              Propuneri în așteptare ({pending.length})
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Cineva a propus o modificare la detaliul tău. Acceptă (intră în teanc) sau respinge.
            </p>
          </div>

          <ul className="flex flex-col gap-6">
            {pending.map((s) => (
              <li key={s.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <AvatarInitials name={s.authorName} imageUrl={s.authorImage} size={30} />
                  <span className="text-sm font-semibold">{s.authorName ?? "Anonim"}</span>
                  <RolePill roleMain={s.authorRoleMain} verified={s.authorVerification === "VERIFIED"} />
                </div>
                <div className="max-w-md">
                  <SketchViewer imageUrl={imageUrl} strokes={s.strokes} />
                </div>
                <div className="flex gap-2">
                  <form action={acceptSketchAction}>
                    <input type="hidden" name="sketchId" value={s.id} />
                    <input type="hidden" name="detailId" value={detailId} />
                    <Button type="submit" size="sm">
                      Acceptă
                    </Button>
                  </form>
                  <form action={rejectSketchAction}>
                    <input type="hidden" name="sketchId" value={s.id} />
                    <input type="hidden" name="detailId" value={detailId} />
                    <Button type="submit" size="sm" variant="outline">
                      Respinge
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
