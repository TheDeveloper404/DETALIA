"use client";

import { useState } from "react";

import { AuthorBadge } from "@/components/author-badge";
import { SketchViewer } from "@/components/sketch/sketch-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          <h2 className="text-sm font-semibold">
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
        <section className="flex flex-col gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Propuneri în așteptare</h2>
            <Badge variant="secondary">{pending.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
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
    <Button
      type="button"
      onClick={onClick}
      size="sm"
      variant={active ? "default" : "outline"}
      className="rounded-full"
    >
      {children}
    </Button>
  );
}
