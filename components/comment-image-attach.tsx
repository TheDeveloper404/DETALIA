"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";

import {
  HEIC_ERROR_MESSAGE,
  isHeicFile,
  isSessionAlive,
  SESSION_EXPIRED_MESSAGE,
  uploadImageToBlob,
} from "@/lib/blob-upload";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_MB } from "@/lib/upload-limits";

// Atașarea UNEI imagini la un comentariu (2026-08-06, cerere Edi).
//
// Fișierul urcă direct browser → Blob prin exact același helper ca restul platformei
// (`uploadImageToBlob` → `/api/blob/upload`, care cere sesiune, verifică statusul contului, aplică
// rate-limit-ul de upload și restrânge tip/mărime). Aici punem doar URL-ul rezultat într-un input
// ascuns; serviciul de comentarii îl revalidează și îl re-encodează server-side — clientul nu e
// sursă de adevăr pentru nimic din asta.
//
// Validarea de mai jos e DOAR pentru feedback rapid (mesaj clar înainte de un upload inutil).
function validate(f: File): string | null {
  if (isHeicFile(f)) return HEIC_ERROR_MESSAGE;
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type)) {
    return "Format neacceptat (PNG, JPG, WebP, AVIF).";
  }
  if (f.size > MAX_IMAGE_BYTES) return `Imaginea e prea mare (max ${MAX_IMAGE_MB} MB).`;
  return null;
}

export function CommentImageAttach({
  disabled = false,
  resetSignal,
}: {
  disabled?: boolean;
  // Rezultatul acțiunii de comentariu — identitate nouă la fiecare trimitere. Curățăm atașamentul DOAR
  // la succes (`ok`), ca următorul comentariu să nu plece cu poza celui precedent; la eroare îl
  // păstrăm, altfel userul ar pierde poza urcată din cauza unei greșeli în text.
  resetSignal?: { ok: boolean };
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ajustare de stare la schimbarea unui prop, în timpul randării (patternul din documentația React,
  // „You Might Not Need an Effect") — nu useEffect + setState, care ar declanșa un render în cascadă.
  const [seenSignal, setSeenSignal] = useState(resetSignal);
  if (resetSignal !== seenSignal) {
    setSeenSignal(resetSignal);
    if (resetSignal?.ok) {
      setUrl(null);
      setError(null);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!f) return;

    const problem = validate(f);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      setUrl(await uploadImageToBlob("comments", f));
    } catch {
      setError((await isSessionAlive()) ? "Încărcarea a eșuat. Încearcă din nou." : SESSION_EXPIRED_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {url && <input type="hidden" name="imageUrl" value={url} />}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        onChange={onPick}
        className="hidden"
      />

      {url ? (
        <span className="relative inline-block w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- previzualizare a unui blob abia urcat */}
          <img
            src={url}
            alt="Imaginea atașată comentariului"
            className="max-h-24 w-auto rounded-md border border-border object-contain"
          />
          <button
            type="button"
            aria-label="Elimină imaginea"
            title="Elimină imaginea"
            onClick={() => setUrl(null)}
            className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-sm transition-colors hover:text-destructive"
          >
            <X className="size-3" strokeWidth={2.5} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] text-[#a59a88] transition-colors hover:text-foreground disabled:opacity-50"
        >
          <ImagePlus className="size-3.5" strokeWidth={2} />
          {busy ? "Se încarcă…" : "Atașează o poză"}
        </button>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
