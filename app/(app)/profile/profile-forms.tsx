"use client";

import Image from "next/image";
import { useActionState, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadImageToBlob } from "@/lib/blob-upload";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_MB } from "@/lib/upload-limits";

import {
  type ProfileFormState,
  deleteAvatar,
  deleteCover,
  saveAvatarUrl,
  saveCoverUrl,
  signOutAction,
  updateProfileDetailsAction,
} from "./actions";

const ACCEPT = ALLOWED_IMAGE_TYPES.join(",");

// Starea inițială a formularelor — definită aici (client), NU în „use server" (care exportă doar funcții async).
const initialProfileState: ProfileFormState = { error: null, ok: false };

type VerificationStatus = "DECLARED" | "PENDING" | "VERIFIED" | "REJECTED";

function Feedback({ error, ok, okText }: { error: string | null; ok: boolean; okText: string }) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p
        role="status"
        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      >
        {okText}
      </p>
    );
  }
  return null;
}

// Flux upload imagine: „Încarcă" (alege fișier) → vezi PREVIEW-ul a ce ai ales → „Salvează".
// Upload-ul merge DIRECT din browser în Vercel Blob (`@vercel/blob/client`) → ocolește limitele
// de body (1MB server action / ~4.5MB funcție Vercel). URL-ul întors se persistă apoi în DB via
// server action (`save`). Validarea reală (tip/mărime/auth) e pe server, la /api/blob/upload.
function ImageUploadForm({
  current,
  folder,
  save,
  remove,
  okText,
  ctaLabel,
  shape,
}: {
  current: string | null;
  folder: string;
  save: (url: string) => Promise<ProfileFormState>;
  remove: () => Promise<ProfileFormState>;
  okText: string;
  ctaLabel: string;
  shape: "circle" | "wide";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(current);
  const [state, setState] = useState<ProfileFormState>(initialProfileState);
  const [busy, setBusy] = useState(false);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    // Validare client = doar UX (serverul re-validează la emiterea tokenului).
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type)) {
      setState({ error: "Format neacceptat (PNG, JPG, WebP, AVIF).", ok: false });
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setState({ error: `Imaginea e prea mare (max ${MAX_IMAGE_MB} MB).`, ok: false });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPicked(f);
    setPreviewUrl(URL.createObjectURL(f));
    setState(initialProfileState);
  }

  async function onSave() {
    if (!picked) return;
    setBusy(true);
    setState(initialProfileState);
    try {
      const url = await uploadImageToBlob(folder, picked);
      const res = await save(url);
      if (!res.ok) {
        setState({ error: res.error, ok: false });
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSavedUrl(url);
      setPicked(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = "";
      setState({ error: null, ok: true });
    } catch {
      setState({ error: "Încărcarea a eșuat. Încearcă din nou.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!window.confirm("Ștergi imaginea?")) return;
    setBusy(true);
    setState(initialProfileState);
    try {
      const res = await remove();
      if (!res.ok) {
        setState({ error: res.error, ok: false });
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSavedUrl(null);
      setPicked(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = "";
      setState({ error: null, ok: true });
    } catch {
      setState({ error: "Ștergerea a eșuat. Încearcă din nou.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  const shown = previewUrl ?? savedUrl;

  return (
    <div className="flex flex-col gap-3">
      <Feedback error={state.error} ok={state.ok} okText={okText} />

      <input ref={inputRef} type="file" accept={ACCEPT} onChange={onPick} className="hidden" />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="h-10"
        >
          {ctaLabel}
        </Button>
        {picked && (
          <Button type="button" onClick={onSave} disabled={busy} className="h-10">
            {busy ? "Se încarcă…" : "Salvează"}
          </Button>
        )}
        {!picked && savedUrl && (
          <Button
            type="button"
            variant="outline"
            onClick={onRemove}
            disabled={busy}
            className="h-10 border-[#e6c9c4] text-[#b0463c] hover:bg-[#fbf1ef]"
          >
            {busy ? "Se șterge…" : "Șterge"}
          </Button>
        )}
      </div>

      {/* Previzualizare: ce-ai ales acum, altfel imaginea curentă. */}
      {shown ? (
        shape === "circle" ? (
          <div className="relative size-24 overflow-hidden rounded-full border border-border bg-secondary">
            <Image
              src={shown}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
              unoptimized={!!previewUrl}
            />
          </div>
        ) : (
          <div className="relative h-28 w-full overflow-hidden rounded-lg border border-border bg-secondary">
            <Image
              src={shown}
              alt=""
              fill
              sizes="400px"
              className="object-cover"
              unoptimized={!!previewUrl}
            />
          </div>
        )
      ) : (
        <p className="text-xs text-muted-foreground">Nicio imagine încă.</p>
      )}

      <span className="text-xs text-muted-foreground">
        PNG, JPG, WebP sau AVIF · max {MAX_IMAGE_MB} MB
        {picked ? ` · ales: ${picked.name}` : ""}
      </span>
    </div>
  );
}

export function AvatarForm({ current }: { current: string | null }) {
  return (
    <ImageUploadForm
      current={current}
      folder="avatars"
      save={saveAvatarUrl}
      remove={deleteAvatar}
      okText="Poza a fost actualizată."
      ctaLabel="Încarcă poză"
      shape="circle"
    />
  );
}

export function CoverForm({ current }: { current: string | null }) {
  return (
    <ImageUploadForm
      current={current}
      folder="covers"
      save={saveCoverUrl}
      remove={deleteCover}
      okText="Imaginea de cover a fost actualizată."
      ctaLabel="Încarcă cover"
      shape="wide"
    />
  );
}

// Editarea datelor de profil (nume, headline, about, locație, website). Rolul NU se editează aici (e definitiv).
export function EditDetailsForm({
  initialName,
  initialHeadline,
  initialAbout,
  initialLocation,
  initialWebsite,
}: {
  initialName: string | null;
  initialHeadline: string | null;
  initialAbout: string | null;
  initialLocation: string | null;
  initialWebsite: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileDetailsAction,
    initialProfileState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback error={state.error} ok={state.ok} okText="Profilul a fost actualizat." />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nume afișat</Label>
        <Input id="name" name="name" required maxLength={100} defaultValue={initialName ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="headline">
          Titlu/headline <span className="font-normal text-muted-foreground">(opțional)</span>
        </Label>
        <Input
          id="headline"
          name="headline"
          maxLength={120}
          placeholder="ex: Arhitect · birou propriu"
          defaultValue={initialHeadline ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="about">
          Despre <span className="font-normal text-muted-foreground">(opțional)</span>
        </Label>
        <Textarea
          id="about"
          name="about"
          maxLength={1000}
          rows={4}
          placeholder="Câteva rânduri despre tine, experiența și domeniile în care lucrezi."
          defaultValue={initialAbout ?? ""}
        />
        <span className="text-xs text-muted-foreground">Apare pe profilul tău public, sub date.</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">
            Locație <span className="font-normal text-muted-foreground">(opțional)</span>
          </Label>
          <Input
            id="location"
            name="location"
            maxLength={120}
            placeholder="ex: Cluj-Napoca"
            defaultValue={initialLocation ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="website">
            Website <span className="font-normal text-muted-foreground">(opțional)</span>
          </Label>
          <Input
            id="website"
            name="website"
            maxLength={200}
            placeholder="ex: detalia.ro"
            defaultValue={initialWebsite ?? ""}
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="h-10 self-start">
        {pending ? "Se salvează…" : "Salvează profilul"}
      </Button>
    </form>
  );
}

export function VerificationSection({ status }: { status: VerificationStatus }) {
  if (status === "VERIFIED") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="text-amber-500">★</span>
        Rolul tău este verificat.
      </p>
    );
  }

  // MVP: verificarea pe bază de dovadă (OAR/CUI → aprobare) e pe HOLD până definim o metodă
  // sigură, cu frecare mică. Nu expunem un buton care duce într-un PENDING fără ieșire.
  // Rolul declarat rămâne funcțional 100%. (Re-activare: readuci formularul de cerere de verificare.)
  return (
    <p className="text-sm text-muted-foreground">
      <strong className="font-semibold text-foreground">Această funcție nu este încă disponibilă.</strong>{" "}
      Până atunci, rolul declarat este funcțional integral.
    </p>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline">
        Deconectare
      </Button>
    </form>
  );
}
