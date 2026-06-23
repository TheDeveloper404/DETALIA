"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from "@/server/domain/detail";

import { createDetailAction, type CreateDetailState } from "./actions";

const initialState: CreateDetailState = { error: null };

export type CategoryOption = { id: string; name: string };

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function DetailForm({ categories }: { categories: CategoryOption[] }) {
  const [state, formAction, pending] = useActionState(createDetailAction, initialState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Titlu</Label>
        <Input
          id="title"
          name="title"
          type="text"
          required
          maxLength={TITLE_MAX_LENGTH}
          placeholder="Ex: Racord termoizolație la soclu"
          className="h-10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">
          Descriere <span className="font-normal text-muted-foreground">(opțional)</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          maxLength={DESCRIPTION_MAX_LENGTH}
          placeholder="Spune contextul detaliului: unde se aplică, ce problemă rezolvă…"
          className="resize-y"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="categoryId">Categorie</Label>
        <select id="categoryId" name="categoryId" required defaultValue="" className={selectClass}>
          <option value="" disabled>
            Alege categoria…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="image">Imagine (detaliul 2D)</Label>
        <Input
          id="image"
          name="image"
          type="file"
          required
          accept="image/png,image/jpeg,image/webp,image/avif"
          onChange={onPickImage}
          className="h-10"
        />
        <span className="text-xs text-muted-foreground">PNG, JPG, WebP sau AVIF · max 8 MB</span>
      </div>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- preview local (blob: URL), nu asset optimizabil
        <img
          src={previewUrl}
          alt="Previzualizare imagine detaliu"
          className="max-h-64 w-full rounded-xl object-contain ring-1 ring-foreground/10"
        />
      )}

      <Button type="submit" disabled={pending} className="h-10 self-start">
        {pending ? "Se publică…" : "Publică detaliul"}
      </Button>
    </form>
  );
}
