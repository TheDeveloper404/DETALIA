"use client";

import { FileText, Loader2, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { DialogOverlay } from "@/components/dialog-overlay";
import { Button } from "@/components/ui/button";
import { isSessionAlive, SESSION_EXPIRED_MESSAGE, uploadDocToBlob } from "@/lib/blob-upload";
import {
  ALLOWED_MATERIAL_EXTENSIONS,
  MAX_MATERIAL_BYTES,
  MAX_MATERIAL_FILES_PER_OFFER,
  MAX_MATERIAL_MB,
} from "@/lib/upload-limits";

import {
  sendMaterialOfferAction,
  withdrawMaterialOfferAction,
  type MaterialOfferState,
} from "./material-offer-actions";

type PendingFile = { url: string; fileName: string; fileSize: number };

export type ExistingMaterialOffer = {
  message: string;
  files: { id: string; url: string; fileName: string; fileSize: number }[];
};

const INITIAL: MaterialOfferState = { ok: true, error: null };

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Modal controlat din exterior (SupplierOfferButton decide când se deschide — click pe mâna ridicată,
// prima dată SAU ulterior, 2026-08-25). „Retrage" e mereu vizibil (nu doar când există deja o ofertă
// trimisă): reface starea INIȚIALĂ dintr-un singur loc — șterge oferta (dacă există) ȘI coboară mâna.
export function MaterialOfferModal({
  detailId,
  existingOffer,
  onClose,
}: {
  detailId: string;
  existingOffer: ExistingMaterialOffer | null;
  onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState(existingOffer?.message ?? "");
  const [files, setFiles] = useState<PendingFile[]>(existingOffer?.files ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(sendMaterialOfferAction, INITIAL);
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(withdrawMaterialOfferAction, INITIAL);

  // Submit-ul reușit (revalidate pe server) închide modalul — altfel userul rămâne pe un formular
  // "trimis" fără feedback vizual că s-a întâmplat ceva. `useEffect`, NU în timpul randării — a apela
  // `onClose` (setState al PĂRINTELUI) direct în corpul componentei încalcă regulile React.
  useEffect(() => {
    if (state.ok && state !== INITIAL && !pending) onClose();
  }, [state, pending, onClose]);
  useEffect(() => {
    if (withdrawState.ok && withdrawState !== INITIAL && !withdrawPending) onClose();
  }, [withdrawState, withdrawPending, onClose]);

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite re-selectarea aceluiași fișier dacă userul îl scoate și-l pune la loc
    if (selected.length === 0) return;
    if (files.length + selected.length > MAX_MATERIAL_FILES_PER_OFFER) {
      setUploadError(`Maxim ${MAX_MATERIAL_FILES_PER_OFFER} fișiere per ofertă.`);
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      for (const file of selected) {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!ext || !(ALLOWED_MATERIAL_EXTENSIONS as readonly string[]).includes(ext)) {
          setUploadError(`„${file.name}" nu e un tip acceptat (PDF, Excel sau CSV).`);
          continue;
        }
        if (file.size > MAX_MATERIAL_BYTES) {
          setUploadError(`„${file.name}" depășește ${MAX_MATERIAL_MB} MB.`);
          continue;
        }
        const url = await uploadDocToBlob("materials", file, "materials");
        setFiles((f) => [...f, { url, fileName: file.name, fileSize: file.size }]);
      }
    } catch {
      setUploadError((await isSessionAlive()) ? "Încărcarea a eșuat. Încearcă din nou." : SESSION_EXPIRED_MESSAGE);
    } finally {
      setUploading(false);
    }
  }

  function removeFile(url: string) {
    setFiles((f) => f.filter((x) => x.url !== url));
  }

  return (
    <DialogOverlay
      onClose={onClose}
      ariaLabel={existingOffer ? "Editează oferta de materiale" : "Oferă materiale"}
      panelClassName="fixed left-1/2 top-1/2 z-50 w-[min(32rem,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-card p-5 shadow-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold">{existingOffer ? "Editează oferta" : "Oferă materiale"}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="detailId" value={detailId} />
        <input type="hidden" name="filesJson" value={JSON.stringify(files)} />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Mesaj</span>
          <textarea
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Ex: Am atașat lista cu materialele disponibile și prețurile orientative."
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            Fișiere ({files.length}/{MAX_MATERIAL_FILES_PER_OFFER})
          </span>
          {files.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {files.map((f) => (
                <li
                  key={f.url}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5"
                >
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                    <span className="truncate">{f.fileName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatSize(f.fileSize)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(f.url)}
                    aria-label={`Elimină ${f.fileName}`}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.csv"
            onChange={onFilesSelected}
            disabled={uploading || files.length >= MAX_MATERIAL_FILES_PER_OFFER}
            className="text-xs file:mr-2 file:rounded-md file:border file:border-input file:bg-background file:px-2.5 file:py-1 file:text-xs"
          />
          <span className="text-xs text-muted-foreground">PDF, Excel sau CSV — max {MAX_MATERIAL_MB} MB / fișier.</span>
          {uploading && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Se încarcă...
            </span>
          )}
          {uploadError && (
            <p role="alert" className="text-xs text-destructive">
              {uploadError}
            </p>
          )}
        </div>

        {state.error && (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <form action={withdrawAction}>
            <input type="hidden" name="detailId" value={detailId} />
            <Button type="submit" variant="ghost" size="sm" disabled={withdrawPending} className="gap-1.5 text-destructive">
              <Trash2 className="size-3.5" strokeWidth={2} />
              {existingOffer ? "Retrage oferta" : "Renunță"}
            </Button>
          </form>
          <Button type="submit" disabled={pending || uploading || files.length === 0}>
            {pending ? "Se trimite..." : existingOffer ? "Salvează" : "Trimite oferta"}
          </Button>
        </div>
        {withdrawState.error && (
          <p role="alert" className="text-xs text-destructive">
            {withdrawState.error}
          </p>
        )}
      </form>
    </DialogOverlay>
  );
}
