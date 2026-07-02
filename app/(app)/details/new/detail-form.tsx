"use client";

import { Check, ChevronDown, Info, Pencil, Plus, RotateCcw, Send, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { SketchCanvas, type SketchCanvasHandle } from "@/components/sketch/sketch-canvas";
import { uploadImageToBlob } from "@/lib/blob-upload";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_MB } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";
import {
  CLIMATE_ZONES,
  DESCRIPTION_MAX_LENGTH,
  MAX_DETAIL_RESOURCES,
  SEISMIC_AG_VALUES,
  SEISMIC_TC_VALUES,
  SNOW_LOAD_VALUES,
  TITLE_MAX_LENGTH,
  WIND_LOAD_VALUES,
} from "@/server/domain/detail";

import { createDetailAction } from "./actions";

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export type CategoryOption = { id: string; name: string; parentId: string | null };

// Tipuri de resursă oferite în formular (oglindesc enum-ul de domeniu; toate stochează un URL/referință).
type ResourceType = "IMAGE" | "LINK" | "PDF";
type ResourceRow = { type: ResourceType; value: string };

// Valori inițiale pentru modul EDITARE (undefined = creare). Acțiunea de submit are aceeași semnătură
// ca `createDetailAction`, deci formularul e comun creare/editare.
export type DetailFormInitial = {
  detailId: string;
  title: string;
  description: string | null;
  categoryIds: string[];
  imageUrl: string;
  climateZone: string | null;
  seismicAg: string;
  seismicTc: string;
  snowLoad: string;
  windLoad: string;
  resources: ResourceRow[];
};

const RESOURCE_LABEL: Record<ResourceType, string> = { IMAGE: "Imagine", LINK: "Link", PDF: "PDF" };
function resourcePlaceholder(type: ResourceType): string {
  if (type === "LINK") return "https://… link către normativ sau articol";
  if (type === "PDF") return "https://… link către fișa tehnică (PDF)";
  return "https://… link către imagine";
}

const labelClass =
  "mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground";
const fieldClass =
  "w-full rounded-[10px] border border-input bg-background px-3.5 py-3 font-sans text-[14.5px] text-foreground transition-colors focus:border-ring focus:outline-none";
const selectClass = cn(fieldClass, "cursor-pointer appearance-none pr-10");

function Req() {
  return <span className="text-primary">*</span>;
}
function Opt() {
  return <span className="text-[10px] normal-case tracking-normal text-[#bdb098]">opțional</span>;
}

// Select stilizat cu săgeată proprie (appearance-none + ChevronDown overlay).
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={selectClass} />
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2}
      />
    </div>
  );
}

// Dropdown multi-select pentru categorii, grupate pe secțiuni — înlocuiește grila de pills
// (prea încărcată vizual) cu un singur trigger + panou derulant cu checkbox-uri.
function CategoryDropdown({
  categories,
  categoryIds,
  toggleCategory,
}: {
  categories: CategoryOption[];
  categoryIds: string[];
  toggleCategory: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const sections = categories.filter((c) => c.parentId === null);
  const leavesOf = (sectionId: string) => categories.filter((c) => c.parentId === sectionId);
  const selectedNames = categories.filter((c) => categoryIds.includes(c.id)).map((c) => c.name);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(selectClass, "flex items-center justify-between text-left")}
      >
        <span className={selectedNames.length === 0 ? "text-muted-foreground" : undefined}>
          {selectedNames.length === 0 ? "Alege categoriile…" : selectedNames.join(", ")}
        </span>
      </button>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-transform",
          open && "rotate-180",
        )}
        strokeWidth={2}
      />

      {open && (
        <div className="absolute z-10 mt-1.5 max-h-80 w-full overflow-y-auto rounded-[10px] border border-input bg-background p-2.5 shadow-[0_18px_44px_-24px_rgba(33,29,24,0.4)]">
          <div className="flex flex-col gap-3">
            {sections.map((section) => (
              <div key={section.id}>
                <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-foreground/60">
                  {section.name}
                </div>
                <div className="flex flex-col">
                  {leavesOf(section.id).map((leaf) => {
                    const active = categoryIds.includes(leaf.id);
                    return (
                      <button
                        key={leaf.id}
                        type="button"
                        onClick={() => toggleCategory(leaf.id)}
                        aria-pressed={active}
                        className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13.5px] text-foreground hover:bg-secondary/70"
                      >
                        <span
                          className={cn(
                            "flex size-4 flex-none items-center justify-center rounded border",
                            active ? "border-primary bg-primary text-primary-foreground" : "border-input",
                          )}
                        >
                          {active && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        {leaf.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DetailForm({
  categories,
  action = createDetailAction,
  initial,
  submitLabel = "Publică detaliul",
}: {
  categories: CategoryOption[];
  action?: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: DetailFormInitial;
  submitLabel?: string;
}) {
  const isEdit = !!initial;
  const [state, formAction, pending] = useActionState(action, initialState);
  // Sursa imaginii detaliului: „upload" (fișier existent) sau „draw" (desenat pe loc, pe foaie goală).
  const [mode, setMode] = useState<"upload" | "draw">("upload");
  // La editare, pornim cu imaginea existentă ca previzualizare (fără fișier local — rămâne cea din Blob).
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(
    initial ? { url: initial.imageUrl, name: "imaginea curentă" } : null,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [resources, setResources] = useState<ResourceRow[]>(initial?.resources ?? []);
  const [drawCount, setDrawCount] = useState(0);
  const [categoryIds, setCategoryIds] = useState<string[]>(initial?.categoryIds ?? []);
  // Semnalăm serverului dacă imaginea s-a schimbat efectiv (la editare) → reprocesare doar atunci.
  const [imageChanged, setImageChanged] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const imageUrlRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<SketchCanvasHandle>(null);

  // La editare fără schimbare de imagine, trimitem URL-ul existent (deja procesat) → onSubmit trece
  // direct, fără re-upload. Îl punem în câmpul ascuns la montare.
  useEffect(() => {
    if (initial && imageUrlRef.current && !imageUrlRef.current.value) {
      imageUrlRef.current.value = initial.imageUrl;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Comutarea sursei resetează starea celeilalte + URL-ul deja urcat (evită trimiterea unei imagini vechi).
  function switchMode(next: "upload" | "draw") {
    if (next === mode) return;
    setMode(next);
    setClientError(null);
    setImageChanged(true); // comutarea sursei = imagine nouă (la editare → reprocesare pe server)
    if (imageUrlRef.current) imageUrlRef.current.value = "";
    if (next === "draw") removeImage();
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setImageFile(null);
      return;
    }
    // Validare client = doar UX (serverul impune tipul/mărimea la emiterea tokenului de upload).
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setClientError("Imaginea trebuie să fie PNG, JPG, WebP sau AVIF.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setClientError(`Imaginea e prea mare (max ${MAX_IMAGE_MB} MB).`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setClientError(null);
    setImageFile(file);
    setImageChanged(true); // fișier nou → la editare, serverul reprocesează + curăță blob-ul vechi
    setPreview({ url: URL.createObjectURL(file), name: file.name });
    if (imageUrlRef.current) imageUrlRef.current.value = ""; // imagine nouă → forțează re-upload
  }
  function removeImage() {
    setPreview(null);
    setImageFile(null);
    if (fileRef.current) fileRef.current.value = "";
    if (imageUrlRef.current) imageUrlRef.current.value = "";
  }

  // Imaginea se urcă DIRECT în Blob înainte de a trimite formularul (ocolește limita de body a
  // server action-ului). Flux: 1) submit → urc imaginea → pun URL-ul în câmpul ascuns → re-submit;
  // 2) la al doilea submit URL-ul există → lăsăm server action-ul să creeze detaliul.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // URL deja urcat (al doilea submit) → lăsăm submit-ul să ajungă la server action.
    if (imageUrlRef.current?.value) return;

    if (categoryIds.length === 0) {
      e.preventDefault();
      setClientError("Alege cel puțin o categorie.");
      return;
    }

    // MOD DESEN: randăm foaia în PNG (client) → urcăm în Blob → re-submit cu URL-ul.
    if (mode === "draw") {
      e.preventDefault();
      if (uploading) return;
      if (drawCount === 0) {
        setClientError("Desenează detaliul înainte de a-l publica.");
        return;
      }
      setUploading(true);
      setClientError(null);
      try {
        const blob = await canvasRef.current?.exportThumbnail();
        if (!blob) throw new Error("export");
        const file = new File([blob], "detaliu.png", { type: "image/png" });
        const url = await uploadImageToBlob("details", file);
        if (imageUrlRef.current) imageUrlRef.current.value = url;
        formRef.current?.requestSubmit();
      } catch {
        setClientError("Salvarea desenului a eșuat. Încearcă din nou.");
      } finally {
        setUploading(false);
      }
      return;
    }

    // MOD UPLOAD: imaginea se urcă DIRECT în Blob înainte de submit (ocolește limita de body).
    if (!imageFile) {
      e.preventDefault();
      setClientError("Alege o imagine pentru detaliu.");
      return;
    }
    e.preventDefault();
    if (uploading) return;
    setUploading(true);
    setClientError(null);
    try {
      const url = await uploadImageToBlob("details", imageFile);
      if (imageUrlRef.current) imageUrlRef.current.value = url;
      formRef.current?.requestSubmit();
    } catch {
      setClientError("Încărcarea imaginii a eșuat. Încearcă din nou.");
    } finally {
      setUploading(false);
    }
  }

  function toggleCategory(id: string) {
    setCategoryIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  const addDisabled = resources.length >= MAX_DETAIL_RESOURCES;
  function addResource() {
    if (!addDisabled) setResources((rs) => [...rs, { type: "LINK", value: "" }]);
  }
  function updateResource(i: number, patch: Partial<ResourceRow>) {
    setResources((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function removeResource(i: number) {
    setResources((rs) => rs.filter((_, j) => j !== i));
  }

  // Serializăm resursele cu valoare ne-goală → câmp ascuns citit de server action.
  const resourcesJson = JSON.stringify(
    resources.filter((r) => r.value.trim().length > 0).map((r) => ({ type: r.type, url: r.value.trim() })),
  );

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col">
      <input type="hidden" name="resources" value={resourcesJson} />
      {/* URL-ul imaginii, completat după upload-ul client direct în Blob. */}
      <input type="hidden" name="imageUrl" ref={imageUrlRef} />
      {/* Editare: id-ul detaliului + semnal dacă imaginea s-a schimbat (pt reprocesare pe server). */}
      {isEdit && <input type="hidden" name="detailId" value={initial.detailId} />}
      {isEdit && <input type="hidden" name="imageChanged" value={imageChanged ? "1" : "0"} />}

      {(clientError ?? state.error) && (
        <p
          role="alert"
          className="mb-5 rounded-[10px] border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          {clientError ?? state.error}
        </p>
      )}

      {/* CARD FORMULAR */}
      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 sm:p-7">
        {/* TITLU */}
        <div>
          <label htmlFor="title" className={labelClass}>
            Titlu <Req />
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={initial?.title ?? ""}
            maxLength={TITLE_MAX_LENGTH}
            placeholder="ex. Atic la acoperiș terasă necirculabilă"
            className={fieldClass}
          />
        </div>

        {/* DESCRIERE */}
        <div>
          <label htmlFor="description" className={labelClass}>
            Descriere <Opt />
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={initial?.description ?? ""}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder="Scrie liber, ca într-un post — ce pui la dezbatere, ce te interesează, ce părere cauți. Textul apare deasupra imaginii."
            className={cn(fieldClass, "resize-y leading-relaxed")}
          />
          <p className="mt-2 font-mono text-[11px] text-[#a59a88]">
            Apare deasupra desenului, în stil post.
          </p>
        </div>

        {/* CATEGORII — bifezi oricâte, printr-un dropdown grupat pe secțiuni. */}
        <div>
          <label className={labelClass}>
            Categorii <Req />
          </label>
          <CategoryDropdown categories={categories} categoryIds={categoryIds} toggleCategory={toggleCategory} />
          {categoryIds.map((id) => (
            <input key={id} type="hidden" name="categoryIds" value={id} />
          ))}
        </div>

        {/* CONTEXT TEHNIC: zonă climatică, seismică (a_g + Tc), încărcare zăpadă/vânt */}
        <div>
          <label className={labelClass}>
            Context tehnic <Opt />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select name="climateZone" defaultValue={initial?.climateZone ?? ""}>
              <option value="">Zonă climatică — nespecificat</option>
              {CLIMATE_ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
            <Select name="seismicAg" defaultValue={initial?.seismicAg ?? "General"}>
              {SEISMIC_AG_VALUES.map((v) => (
                <option key={v} value={v}>
                  a_g {v}
                </option>
              ))}
            </Select>
            <Select name="seismicTc" defaultValue={initial?.seismicTc ?? "General"}>
              {SEISMIC_TC_VALUES.map((v) => (
                <option key={v} value={v}>
                  Tc {v}
                </option>
              ))}
            </Select>
            <Select name="snowLoad" defaultValue={initial?.snowLoad ?? "General"}>
              {SNOW_LOAD_VALUES.map((v) => (
                <option key={v} value={v}>
                  Zăpadă {v}
                </option>
              ))}
            </Select>
            <Select name="windLoad" defaultValue={initial?.windLoad ?? "General"}>
              {WIND_LOAD_VALUES.map((v) => (
                <option key={v} value={v}>
                  Vânt {v}
                </option>
              ))}
            </Select>
          </div>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-[#a59a88]">
            Lasă „General” dacă nu se aplică. Valorile reale dau greutate detaliului în dezbatere.
          </p>
        </div>

        {/* IMAGINEA 2D */}
        <div className="border-t border-[#eee6da] pt-6">
          <label className={labelClass}>
            Imaginea 2D a detaliului <Req />
          </label>

          {/* Alege sursa: încarci un fișier gata făcut sau desenezi detaliul pe loc, pe o foaie goală. */}
          <div className="mb-3 inline-flex rounded-[10px] border border-[#e6ddcf] bg-[#f6ede4] p-1">
            {([
              { key: "upload", label: "Încarcă fișier", Icon: Upload },
              { key: "draw", label: "Desenează", Icon: Pencil },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                aria-pressed={mode === key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[7px] px-3.5 py-2 font-heading text-[13.5px] font-semibold transition-colors",
                  mode === key
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-[15px]" strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>

          {/* input file ascuns, declanșat de dropzone / butonul Înlocuiește */}
          <input
            ref={fileRef}
            id="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            onChange={onPickImage}
            className="sr-only"
          />

          {mode === "draw" ? (
            <div className="flex h-[70vh] max-h-[760px] min-h-[520px] overflow-hidden rounded-[14px] border border-[#e6ddcf] bg-[#efece6]">
              <SketchCanvas ref={canvasRef} initialStrokes={[]} onStrokesCount={setDrawCount} />
            </div>
          ) : !preview ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="dt-drop relative flex w-full flex-col items-center justify-center gap-3.5 overflow-hidden rounded-[14px] border-[1.5px] border-dashed border-[#d8cfc0] bg-[#faf7f1] px-6 py-12 transition-colors hover:border-primary"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "linear-gradient(#ece1cd 1px,transparent 1px),linear-gradient(90deg,#ece1cd 1px,transparent 1px)",
                  backgroundSize: "26px 26px",
                }}
              />
              <span className="relative flex size-[54px] items-center justify-center rounded-[14px] border border-[#e6ddcf] bg-secondary">
                <Upload className="size-6 text-primary" strokeWidth={1.8} />
              </span>
              <span className="relative font-heading text-[15.5px] font-bold text-foreground">
                Încarcă desenul
              </span>
              <span className="relative text-center font-mono text-[11.5px] leading-relaxed text-muted-foreground">
                Secțiune sau plan de detaliu — PNG, JPG, WebP sau AVIF
                <br />
                max {MAX_IMAGE_MB} MB · ideal min. 1200 px pe latura mare
              </span>
            </button>
          ) : (
            <div className="relative overflow-hidden rounded-[14px] border border-[#e6ddcf] bg-[#faf7f1]">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "linear-gradient(#ece1cd 1px,transparent 1px),linear-gradient(90deg,#ece1cd 1px,transparent 1px)",
                  backgroundSize: "26px 26px",
                }}
              />
              <div className="absolute right-3 top-3 z-[2] flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e6dccd] bg-white/90 px-2.5 py-1.5 font-heading text-[12.5px] font-semibold text-foreground/80"
                >
                  <RotateCcw className="size-3" strokeWidth={1.9} />
                  Înlocuiește
                </button>
                <button
                  type="button"
                  onClick={removeImage}
                  aria-label="Elimină imaginea"
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-[#eccbc6] bg-white/90"
                >
                  <Trash2 className="size-3.5 text-destructive" strokeWidth={2} />
                </button>
              </div>
              <div className="relative z-[1] flex items-center justify-center p-6">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview local (blob:), nu asset optimizabil */}
                <img
                  src={preview.url}
                  alt="Previzualizare detaliu"
                  className="max-h-80 w-auto max-w-full object-contain"
                />
              </div>
              <div className="relative z-[2] flex items-center gap-2 border-t border-[#eee6da] bg-card px-3.5 py-2.5">
                <Send className="size-3.5 rotate-0 text-[#7a8a3f]" strokeWidth={1.9} />
                <span className="truncate font-mono text-[12px] text-muted-foreground">
                  {preview.name}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RESURSE SUPLIMENTARE */}
        <div className="border-t border-[#eee6da] pt-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <label className={cn(labelClass, "mb-0")}>
              Resurse suplimentare <Opt />
            </label>
            <span
              className={cn(
                "font-mono text-[11px]",
                addDisabled ? "text-primary" : "text-[#a59a88]",
              )}
            >
              {resources.length} / {MAX_DETAIL_RESOURCES}
            </span>
          </div>

          {resources.length > 0 && (
            <div className="mb-3 flex flex-col gap-2.5">
              {resources.map((r, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="relative w-[132px] flex-none">
                    <select
                      value={r.type}
                      onChange={(e) => updateResource(i, { type: e.target.value as ResourceType })}
                      className={cn(selectClass, "px-3 py-2.5 text-[13.5px]")}
                    >
                      {(Object.keys(RESOURCE_LABEL) as ResourceType[]).map((t) => (
                        <option key={t} value={t}>
                          {RESOURCE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                      strokeWidth={2}
                    />
                  </div>
                  <input
                    type="text"
                    value={r.value}
                    onChange={(e) => updateResource(i, { value: e.target.value })}
                    placeholder={resourcePlaceholder(r.type)}
                    className={cn(fieldClass, "min-w-0 flex-1 px-3 py-2.5 text-[13.5px]")}
                  />
                  <button
                    type="button"
                    onClick={() => removeResource(i)}
                    aria-label="Elimină resursa"
                    className="inline-flex size-[38px] flex-none items-center justify-center rounded-[9px] border border-input bg-card transition-colors hover:border-destructive"
                  >
                    <X className="size-3.5 text-destructive" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addResource}
            disabled={addDisabled}
            className={cn(
              "inline-flex items-center gap-2 rounded-[9px] border px-3.5 py-2.5 font-heading text-[13.5px] font-semibold transition-colors",
              addDisabled
                ? "cursor-not-allowed border-[#e6ddcf] bg-[#f4f1ea] text-[#c4bbac]"
                : "border-[#ecdcc8] bg-[#f6ede4] text-primary hover:border-primary",
            )}
          >
            <Plus className="size-[15px]" strokeWidth={2} />
            Adaugă resursă
          </button>
          {addDisabled && (
            <span className="ml-3 font-mono text-[11px] text-[#a59a88]">Maxim 3 resurse.</span>
          )}
        </div>
      </div>

      {/* FOOTER: notă + acțiuni */}
      <div className="mt-4 flex items-center gap-2.5 rounded-[11px] border border-[#e6ddcf] bg-secondary px-4 py-3">
        <Info className="size-4 flex-none text-primary" strokeWidth={1.9} />
        <span className="text-[13.5px] leading-snug text-muted-foreground text-pretty">
          {isEdit
            ? "Modificările apar imediat pe pagina detaliului."
            : "Detaliul devine public imediat — fără coadă de aprobare. Comunitatea îl validează pe roluri."}
        </span>
      </div>

      <div className="mt-4 flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">
        <Link
          href={isEdit ? `/details/${initial.detailId}` : "/feed"}
          className="inline-flex items-center justify-center rounded-[10px] border border-[#d8cfc0] bg-card px-5 py-3 font-heading text-[15px] font-semibold transition-colors hover:border-primary"
        >
          Renunță
        </Link>
        <button
          type="submit"
          disabled={pending || uploading}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#95492e] bg-primary px-6 py-3 font-heading text-[15px] font-bold text-primary-foreground transition-colors hover:bg-[#974a2e] disabled:opacity-60"
        >
          <Send className="size-4" strokeWidth={2} />
          {uploading
            ? mode === "draw"
              ? "Se salvează desenul…"
              : "Se încarcă imaginea…"
            : pending
              ? isEdit
                ? "Se salvează…"
                : "Se publică…"
              : submitLabel}
        </button>
      </div>
    </form>
  );
}
