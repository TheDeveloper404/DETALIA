"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import {
  type ProfileFormState,
  deleteAvatar,
  deleteCover,
  saveAvatarUrl,
  saveCoverPosition,
  saveCoverUrl,
} from "@/app/(app)/profile/actions";
import { AvatarInitials } from "@/components/avatar-initials";
import { uploadImageToBlob } from "@/lib/blob-upload";
import { ALLOWED_IMAGE_TYPES, MAX_AVATAR_BYTES, MAX_AVATAR_MB } from "@/lib/upload-limits";

const ACCEPT = ALLOWED_IMAGE_TYPES.join(",");

function validate(f: File): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type)) {
    return "Format neacceptat (PNG, JPG, WebP, AVIF).";
  }
  if (f.size > MAX_AVATAR_BYTES) {
    return `Imaginea e prea mare (max ${MAX_AVATAR_MB} MB).`;
  }
  return null;
}

// Editare „in place" a unei imagini (avatar sau cover): click pe imagine → file picker → upload direct
// în Blob → persistare via server action. Fără pas separat de preview/Salvează (UI mai curat — clickul
// pe imagine e deja intenția). Validarea reală (tip/mărime/auth) rămâne pe server, la /api/blob/upload.
// Ref-ul input-ului e ținut de componentă (nu returnat din hook) ca să nu atingem regula react-hooks/refs.
function useImageTarget(
  folder: string,
  initial: string | null,
  save: (url: string) => Promise<ProfileFormState>,
  remove: () => Promise<ProfileFormState>,
  inputRef: React.RefObject<HTMLInputElement | null>,
) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick() {
    setError(null);
    inputRef.current?.click();
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!f) return;
    const v = validate(f);
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadImageToBlob(folder, f, "avatar");
      const res = await save(uploaded);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Afișăm URL-ul CURAT întors de server (reprocesat). `uploaded` a fost deja șters la reprocesare,
      // deci nu îl putem folosi pentru preview — altfel imaginea apare spartă până la refresh.
      setUrl(res.url ?? uploaded);
    } catch {
      setError("Încărcarea a eșuat. Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("Ștergi imaginea?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await remove();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setUrl(null);
    } catch {
      setError("Ștergerea a eșuat. Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  }

  return { url, busy, error, pick, onChange, onDelete };
}

// Antetul paginii de editare profil: cover + avatar + identitate, toate editabile „in place".
// Cover-ul se repoziționează trăgând direct de el (object-position Y, 0..100). Avatar și cover se
// schimbă/șterg din butoanele suprapuse pe imagine — fără carduri separate de upload.
export function EditProfileHeader({
  name,
  email,
  roleLabel,
  verified,
  image,
  cover,
  coverPosition,
}: {
  name: string | null;
  email: string | null;
  roleLabel: string;
  verified: boolean;
  image: string | null;
  cover: string | null;
  coverPosition: number;
}) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatar = useImageTarget("avatars", image, saveAvatarUrl, deleteAvatar, avatarInputRef);
  const coverT = useImageTarget("covers", cover, saveCoverUrl, deleteCover, coverInputRef);

  // Repoziționare cover (LinkedIn-style): tragi sus/jos în banner, la eliberare se salvează poziția.
  const [pos, setPos] = useState(coverPosition);
  const bandRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startPos: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (!coverT.url || coverT.busy) return;
    drag.current = { startY: e.clientY, startPos: pos };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const h = bandRef.current?.offsetHeight ?? 120;
    const delta = ((e.clientY - drag.current.startY) / h) * 100;
    setPos(Math.round(Math.min(100, Math.max(0, drag.current.startPos - delta))));
  }
  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    void saveCoverPosition(pos);
  }

  const draggable = coverT.url && !coverT.busy;
  const headerError = avatar.error ?? coverT.error;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Cover */}
      <div
        ref={bandRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`relative h-[120px] bg-gradient-to-br from-secondary to-[#ece1d3] ${
          draggable ? "cursor-grab touch-none active:cursor-grabbing" : ""
        }`}
      >
        {coverT.url && (
          // eslint-disable-next-line @next/next/no-img-element -- repoziționare live; nu e asset optimizabil
          <img
            src={coverT.url}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full select-none object-cover"
            style={{ objectPosition: `50% ${pos}%` }}
          />
        )}

        {coverT.url && !coverT.busy && (
          <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10.5px] text-white">
            trage sus/jos pentru a repoziționa
          </span>
        )}

        {/* Controale cover (stopPropagation ca să nu pornească drag-ul din banner) */}
        <div
          className="absolute right-2 top-2 flex gap-1.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={coverT.pick}
            disabled={coverT.busy}
            aria-label="Schimbă imaginea de cover"
            className="inline-flex size-8 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70 disabled:opacity-60"
          >
            <Camera className="size-4" />
          </button>
          {coverT.url && (
            <button
              type="button"
              onClick={coverT.onDelete}
              disabled={coverT.busy}
              aria-label="Șterge imaginea de cover"
              className="inline-flex size-8 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70 disabled:opacity-60"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>

        {coverT.busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="size-5 animate-spin text-white" />
          </div>
        )}

        <input
          ref={coverInputRef}
          type="file"
          accept={ACCEPT}
          onChange={coverT.onChange}
          className="hidden"
        />
      </div>

      {/* Avatar + identitate */}
      <div className="flex items-end gap-4 px-5 pb-4">
        <div className="relative -mt-9">
          <AvatarInitials
            name={name}
            imageUrl={avatar.url}
            size={72}
            className="border-4 border-card"
          />

          <button
            type="button"
            onClick={avatar.pick}
            disabled={avatar.busy}
            aria-label="Schimbă poza de profil"
            className="absolute -bottom-1 -right-1 inline-flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            <Camera className="size-3.5" />
          </button>
          {avatar.url && (
            <button
              type="button"
              onClick={avatar.onDelete}
              disabled={avatar.busy}
              aria-label="Șterge poza de profil"
              className="absolute -right-1 -top-1 inline-flex size-7 items-center justify-center rounded-full border-2 border-card bg-card text-[#b0463c] shadow-sm transition hover:bg-[#fbf1ef] disabled:opacity-60"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          {avatar.busy && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
              <Loader2 className="size-4 animate-spin text-white" />
            </div>
          )}

          <input
            ref={avatarInputRef}
            type="file"
            accept={ACCEPT}
            onChange={avatar.onChange}
            className="hidden"
          />
        </div>

        <div className="min-w-0 pb-1">
          <div className="truncate text-lg font-bold">{name ?? "Profilul tău"}</div>
          <div className="truncate font-mono text-[12px] text-muted-foreground">
            {roleLabel}
            {verified && <span className="text-[#d99a2b]"> ★</span>}
          </div>
          {email && <div className="truncate text-[12px] text-muted-foreground">{email}</div>}
        </div>
      </div>

      {headerError && (
        <p
          role="alert"
          className="border-t border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive"
        >
          {headerError}
        </p>
      )}

      <p className="px-5 pb-3 text-xs text-muted-foreground">
        PNG, JPG, WebP sau AVIF · max {MAX_AVATAR_MB} MB
      </p>
    </div>
  );
}
