"use client";

import { useState } from "react";

import { AuthorBadge } from "@/components/author-badge";
import { SketchViewer } from "@/components/sketch/sketch-viewer";
import type { Stroke } from "@/server/domain/sketch";
import type { ValidationPosition } from "@/server/domain/validation";
import type { TargetComment } from "@/server/repos/commentsRepo";
import type { TargetPosition } from "@/server/repos/validationsRepo";

import { CommentsSection } from "./comments-section";
import { acceptSketchAction, rejectSketchAction } from "./sketch-review-actions";
import { ValidationPanel } from "./validation-panel";

export type SketchItem = {
  id: string;
  authorName: string | null;
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
}: {
  detailId: string;
  imageUrl: string;
  published: PublishedSketchItem[];
  pending: SketchItem[]; // gol dacă userul curent nu e autorul-mamă
}) {
  // Tab 0 = Original; 1..N = schițele publicate (teancul).
  const [tab, setTab] = useState(0);
  const active = tab === 0 ? null : published[tab - 1];

  if (published.length === 0 && pending.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      {published.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Teanc — propuneri publicate ({published.length})
          </h2>

          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === 0} onClick={() => setTab(0)}>
              Original
            </TabButton>
            {published.map((s, i) => (
              <TabButton key={s.id} active={tab === i + 1} onClick={() => setTab(i + 1)}>
                {s.authorName ?? `Schiță ${i + 1}`}
              </TabButton>
            ))}
          </div>

          <SketchViewer imageUrl={imageUrl} strokes={active?.strokes ?? []} />

          {active && (
            <div className="flex flex-col gap-4">
              <AuthorBadge
                name={active.authorName}
                roleMain={active.authorRoleMain}
                subRole={active.authorSubRole}
                verified={active.authorVerification === "VERIFIED"}
              />
              {/* Dezbaterea pe schiță (polimorfic, targetType=SKETCH). Fără buton „fac o schiță". */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                />
              </div>
            </div>
          )}
        </section>
      )}

      {pending.length > 0 && (
        <section className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Propuneri în așteptare ({pending.length})
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Cineva a propus o modificare la detaliul tău. Acceptă (intră în teanc) sau respinge.
          </p>

          <ul className="flex flex-col gap-5">
            {pending.map((s) => (
              <li key={s.id} className="flex flex-col gap-2">
                <AuthorBadge
                  name={s.authorName}
                  roleMain={s.authorRoleMain}
                  subRole={s.authorSubRole}
                  verified={s.authorVerification === "VERIFIED"}
                />
                <SketchViewer imageUrl={imageUrl} strokes={s.strokes} />
                <div className="flex gap-2">
                  <form action={acceptSketchAction}>
                    <input type="hidden" name="sketchId" value={s.id} />
                    <input type="hidden" name="detailId" value={detailId} />
                    <button
                      type="submit"
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                      Acceptă
                    </button>
                  </form>
                  <form action={rejectSketchAction}>
                    <input type="hidden" name="sketchId" value={s.id} />
                    <input type="hidden" name="detailId" value={detailId} />
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Respinge
                    </button>
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${active ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300"}`}
    >
      {children}
    </button>
  );
}
