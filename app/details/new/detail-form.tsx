"use client";

import { useActionState, useState } from "react";

import { TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from "@/server/domain/detail";

import { createDetailAction, type CreateDetailState } from "./actions";

const initialState: CreateDetailState = { error: null };

export type CategoryOption = { id: string; name: string };

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

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
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Titlu</span>
        <input
          name="title"
          type="text"
          required
          maxLength={TITLE_MAX_LENGTH}
          placeholder="Ex: Racord termoizolație la soclu"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">
          Descriere <span className="text-zinc-400">(opțional)</span>
        </span>
        <textarea
          name="description"
          rows={4}
          maxLength={DESCRIPTION_MAX_LENGTH}
          placeholder="Spune contextul detaliului: unde se aplică, ce problemă rezolvă…"
          className={`${inputClass} resize-y`}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Categorie</span>
        <select name="categoryId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Alege categoria…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Imagine (detaliul 2D)</span>
        <input
          name="image"
          type="file"
          required
          accept="image/png,image/jpeg,image/webp,image/avif"
          onChange={onPickImage}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white dark:file:bg-zinc-100 dark:file:text-zinc-900"
        />
        <span className="text-xs text-zinc-400">PNG, JPG, WebP sau AVIF · max 8 MB</span>
      </label>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- preview local (blob: URL), nu asset optimizabil
        <img
          src={previewUrl}
          alt="Previzualizare imagine detaliu"
          className="max-h-64 w-full rounded-md border border-zinc-200 object-contain dark:border-zinc-800"
        />
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Se publică…" : "Publică detaliul"}
      </button>
    </form>
  );
}
