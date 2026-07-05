"use client";

import { LayoutDashboard, Loader2, MoreVertical, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCanvasAction,
  deleteCanvasAction,
  renameCanvasAction,
} from "./canvas-list-actions";

type CanvasItem = { id: string; name: string; thumbnailUrl: string | null; updatedAt: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
}

export function CanvasesList({ canvases }: { canvases: CanvasItem[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submitNew = () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createCanvasAction(trimmed);
      if (!res.ok) {
        setError(res.error ?? "Nu am putut crea planșa.");
        return;
      }
      setCreating(false);
      setName("");
      if (res.canvasId) router.push(`/canvases/${res.canvasId}/edit`);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Creare planșă nouă */}
      {creating ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNew();
                if (e.key === "Escape") setCreating(false);
              }}
              maxLength={80}
              placeholder="Nume planșă (ex. „Secțiune perete casa mea”)"
              disabled={pending}
            />
            <Button onClick={submitNew} disabled={pending || !name.trim()}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Creează"}
            </Button>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={pending}>
              Renunță
            </Button>
          </div>
          {error && <p className="font-mono text-[12px] text-destructive">{error}</p>}
        </div>
      ) : (
        <div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" strokeWidth={2} />
            Planșă nouă
          </Button>
        </div>
      )}

      {/* Listă / empty state */}
      {canvases.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-card px-8 py-16 text-center">
          <div className="mb-[22px] flex size-16 items-center justify-center rounded-lg border border-border bg-secondary">
            <LayoutDashboard className="size-7 text-primary" strokeWidth={1.8} />
          </div>
          <h2 className="mb-2 text-[22px] font-bold">Nicio planșă încă</h2>
          <p className="max-w-[46ch] leading-relaxed text-muted-foreground">
            O planșă e spațiul tău privat de lucru: aduni detalii cu „Trimite în Planșă”, le aranjezi
            și schițezi peste ele. Creează prima planșă sau adaugă un detaliu din feed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canvases.map((c) => (
            <CanvasCard key={c.id} canvas={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CanvasCard({ canvas }: { canvas: CanvasItem }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="group relative flex flex-col rounded-lg border border-border bg-card">
      {/* `overflow-hidden` STRICT local pe thumbnail (nu pe wrapper-ul cardului) — altfel clipează
          dropdown-ul kebab (redenumește/șterge) din zona de sub thumbnail. */}
      <Link href={`/canvases/${canvas.id}/edit`} className="block overflow-hidden rounded-t-lg">
        <div className="relative aspect-[4/3] w-full bg-secondary">
          {canvas.thumbnailUrl ? (
            <Image
              src={canvas.thumbnailUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 300px"
              className="object-contain"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <LayoutDashboard className="size-8 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
          )}
        </div>
      </Link>

      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          {renaming ? (
            <form ref={formRef} action={renameCanvasAction} className="flex items-center gap-1.5">
              <input type="hidden" name="canvasId" value={canvas.id} />
              <Input
                name="name"
                autoFocus
                defaultValue={canvas.name}
                maxLength={80}
                onBlur={() => setRenaming(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") formRef.current?.requestSubmit();
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="h-7"
              />
            </form>
          ) : (
            <Link href={`/canvases/${canvas.id}/edit`} className="block truncate font-medium hover:underline">
              {canvas.name}
            </Link>
          )}
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{formatDate(canvas.updatedAt)}</p>
        </div>

        {/* Meniu (redenumește / șterge) */}
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreVertical className="size-4" strokeWidth={2} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setRenaming(true);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                >
                  Redenumește
                </button>
                <form action={deleteCanvasAction}>
                  <input type="hidden" name="canvasId" value={canvas.id} />
                  <button
                    type="submit"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[13px] text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" strokeWidth={2} />
                    Șterge
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
