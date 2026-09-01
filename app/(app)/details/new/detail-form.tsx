"use client";

import { Check, ChevronDown, FileCheck, Info, LayoutGrid, Pencil, Plus, RotateCcw, Save, Send, Trash2, Upload, X } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { CanvasCropPicker, type CropCanvasOption } from "@/components/canvas-crop-picker";
import type { SketchCanvasHandle } from "@/components/sketch/sketch-canvas";
import { SketchViewer } from "@/components/sketch/sketch-viewer";
import {
  computeExtent,
  isUnitExtent,
  MAX_SKETCH_NOTE_LENGTH,
  type Stroke,
} from "@/server/domain/sketch";
import {
  HEIC_ERROR_MESSAGE,
  HeicUnsupportedError,
  SESSION_EXPIRED_MESSAGE,
  isHeicFile,
  isSessionAlive,
  uploadDocToBlob,
  uploadImageToBlob,
} from "@/lib/blob-upload";
import {
  looksLikeUploadedResource,
  UPLOADABLE_RESOURCE_TYPES,
  type ResourceType,
} from "@/lib/resource-type";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_CAD_BYTES,
  MAX_CAD_MB,
  MAX_DOC_BYTES,
  MAX_DOC_MB,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
} from "@/lib/upload-limits";
import { cn } from "@/lib/utils";
import {
  CLIMATE_ZONES,
  DEFAULT_LOCATION,
  DESCRIPTION_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  MAX_DETAIL_RESOURCES,
  SEISMIC_AG_VALUES,
  SEISMIC_TC_VALUES,
  SNOW_LOAD_VALUES,
  TITLE_MAX_LENGTH,
  WIND_LOAD_VALUES,
} from "@/server/domain/detail";

import { createDetailAction } from "./actions";

// Editorul de schiță (perfect-freehand + engine propriu) nu are nevoie de SSR — apare doar în pasul
// opțional de desen al formularului. Scos din bundle-ul global ca să nu-l plătească restul site-ului.
const SketchCanvas = dynamic(
  () => import("@/components/sketch/sketch-canvas").then((m) => m.SketchCanvas),
  { ssr: false, loading: () => <div className="flex-1 bg-muted/30" /> },
);

type FormState = { error: string | null };
const initialState: FormState = { error: null };

export type CategoryOption = { id: string; name: string; parentId: string | null; isGroup: boolean };

// Tipuri de resursă oferite în formular (oglindesc enum-ul de domeniu; toate stochează un URL/referință).
type ResourceRow = { type: ResourceType; value: string };

// Plafon pentru adnotarea trimisă în body-ul server action-ului. Mult sub `bodySizeLimit` (4 MB,
// next.config.ts) ca să rămână loc pentru restul formularului — și sub `MAX_STROKES_BYTES` (3 MB,
// domain/sketch.ts), care singur ar putea satura body-ul. Un desen normal e cu ordine de mărime sub.
const MAX_ANNOTATION_BYTES = 1_500_000; // 1.5 MB

// Valori inițiale pentru modul EDITARE (undefined = creare). Acțiunea de submit are aceeași semnătură
// ca `createDetailAction`, deci formularul e comun creare/editare.
export type DetailFormInitial = {
  detailId: string;
  title: string;
  description: string | null;
  categoryIds: string[];
  // null = ciornă fără imagine încă (înainte de upload).
  imageUrl: string | null;
  location: string;
  climateZone: string | null;
  seismicAg: string;
  seismicTc: string;
  snowLoad: string;
  windLoad: string;
  resources: ResourceRow[];
  // Adnotarea EXISTENTĂ (2026-08-11) — doar în modul editare, doar dacă detaliul are deja una
  // (MAX_ANNOTATIONS_PER_DETAIL = 1, domain/sketch.ts). Prezența ei distinge create vs update în
  // acțiunea de submit (vezi `annotationSketchId` mai jos).
  annotation: { id: string; strokes: Stroke[]; note: string | null } | null;
};

const RESOURCE_LABEL: Record<ResourceType, string> = {
  IMAGE: "Imagine",
  LINK: "Link",
  PDF: "PDF",
  CAD: "Plan CAD",
};
function resourcePlaceholder(type: ResourceType): string {
  if (type === "LINK") return "https://… link către normativ sau articol";
  if (type === "PDF") return "https://… link (sau încarcă fișierul PDF)";
  if (type === "CAD") return "https://… link (sau încarcă fișierul DWG/DXF)";
  return "https://… link (sau încarcă imaginea)";
}

// „Imagine" fără upload real nu se folosea aproape deloc (userul trebuia să aibă deja un link extern
// către o imagine găzduită) — 2026-07-16. `ResourceType`/`UPLOADABLE_RESOURCE_TYPES`/
// `looksLikeUploadedResource` trăiesc în lib/resource-type.ts (fără dependențe grele — testabile unitar).
function resourceFileAccept(type: ResourceType): string {
  if (type === "CAD") return ".dwg,.dxf";
  if (type === "PDF") return "application/pdf";
  return (ALLOWED_IMAGE_TYPES as readonly string[]).join(",");
}
function resourceUploadLimitLabel(type: ResourceType): string {
  if (type === "CAD") return `max ${MAX_CAD_MB}MB`;
  if (type === "PDF") return `max ${MAX_DOC_MB}MB`;
  return `max ${MAX_IMAGE_MB}MB`;
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
  // „Capitolele" cu sub-categorii (ex. Instalații) pornesc colapsate — apeși săgeata, se deschid copiii
  // (cerință de produs: „dacă apăs, mi se deschid cele patru").
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
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
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);
  const selectedNames = categories.filter((c) => categoryIds.includes(c.id)).map((c) => c.name);

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="category-dropdown-trigger"
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
        <div
          data-testid="category-dropdown-panel"
          className="absolute z-10 mt-1.5 max-h-80 w-full overflow-y-auto rounded-[10px] border border-input bg-background p-2.5 shadow-[0_18px_44px_-24px_rgba(33,29,24,0.4)]"
        >
          <div className="flex flex-col gap-3">
            {sections.map((section) => (
              <div key={section.id}>
                <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-foreground/60">
                  {section.name}
                </div>
                <div className="flex flex-col">
                  {childrenOf(section.id).map((leaf) => {
                    // „Capitol" (isGroup) — ex. Instalații: neselectabil el însuși, doar un antet
                    // expandabil pentru sub-categoriile lui (Electrice/Sanitare/Termice/HVAC).
                    if (leaf.isGroup) {
                      const isExpanded = expandedGroups.has(leaf.id);
                      return (
                        <div key={leaf.id}>
                          <button
                            type="button"
                            onClick={() => toggleGroup(leaf.id)}
                            aria-expanded={isExpanded}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] font-medium text-foreground hover:bg-secondary/70"
                          >
                            <ChevronDown
                              className={cn(
                                "size-3.5 flex-none text-muted-foreground transition-transform",
                                isExpanded && "rotate-180",
                              )}
                              strokeWidth={2}
                            />
                            {leaf.name}
                          </button>
                          {isExpanded && (
                            <div className="ml-5 flex flex-col border-l border-border pl-2">
                              {childrenOf(leaf.id).map((sub) => {
                                const active = categoryIds.includes(sub.id);
                                return (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => toggleCategory(sub.id)}
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
                                    {sub.name}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

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

// No-op — folosit când `saveDraftAction` nu e dat (ex. editare detaliu PUBLISHED, fără ciornă posibilă),
// ca al doilea `useActionState` să aibă mereu ceva de apelat (hook-urile nu pot fi condiționale).
async function noopDraftAction(prev: FormState): Promise<FormState> {
  return prev;
}

export function DetailForm({
  categories,
  action = createDetailAction,
  saveDraftAction,
  initial,
  submitLabel = "Publică detaliul",
  projectId,
  myCanvases,
}: {
  categories: CategoryOption[];
  action?: (prev: FormState, formData: FormData) => Promise<FormState>;
  // Dat = arată și butonul „Salvează ciornă" (pe /new, sau pe /edit cât timp detaliul e DRAFT).
  saveDraftAction?: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: DetailFormInitial;
  submitLabel?: string;
  // Proiecte (2026-08-09): publicare într-un proiect în loc de comunitate — vezi /details/new/page.tsx.
  // Un detaliu de proiect NU poate fi ciornă (invarianta din server/domain/project.ts), deci pagina
  // apelantă nu mai dă `saveDraftAction` când `projectId` e prezent.
  projectId?: string;
  // §7 din plan (Faza C, 2026-08-11): a treia sursă de imagine, „dintr-o planșă" — doar la CREARE
  // (fără `initial`), scop asumat din plan. Absent = tab-ul nu apare (edit-ul nu-l primește).
  myCanvases?: CropCanvasOption[];
}) {
  const isEdit = !!initial;
  // Adnotarea se trimite DOAR spre `createDetailAction` (creare) sau `updateDetailAction` (editarea
  // unui detaliu PUBLICAT) — vezi 2026-08-11. Fluxul de „Continuă ciorna" (`publishDraftDetailAction`,
  // recunoscut aici prin prezența `saveDraftAction`) NU citește `annotationStrokes`/`annotationSketchId`
  // deloc; a arăta butonul acolo ar pierde desenul silențios la submit. Rămâne scop separat.
  const canAnnotate = !isEdit || !saveDraftAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [draftState, draftFormAction, draftPending] = useActionState(
    saveDraftAction ?? noopDraftAction,
    initialState,
  );
  // Sursa imaginii detaliului: „upload" (fișier existent), „draw" (desenat pe loc, pe foaie goală) sau
  // „canvas" (decupaj dintr-o planșă proprie, §7 din plan — vezi CanvasCropPicker). „canvas" e un pas
  // TRANZITORIU: la „Aplică decupajul" revenim direct pe „upload" cu fișierul rezultat (acțiunea de
  // submit tratează decupajul EXACT ca un upload normal, fără cod separat).
  const [mode, setMode] = useState<"upload" | "draw" | "canvas">("upload");
  // La editare, pornim cu imaginea existentă ca previzualizare (null = ciornă fără imagine încă).
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(
    initial?.imageUrl ? { url: initial.imageUrl, name: "imaginea curentă" } : null,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [resources, setResources] = useState<ResourceRow[]>(initial?.resources ?? []);
  // Indecșii resurselor „încărcate" (fișier urcat de noi, nu link lipit de mână) — arată previzualizare
  // compactă în loc de câmpul de text cu URL-ul. Inițializat și din resursele EXISTENTE (editare), nu
  // doar din upload-uri noi în sesiunea curentă.
  const [uploadedResourceIndices, setUploadedResourceIndices] = useState<Set<number>>(
    () =>
      new Set(
        (initial?.resources ?? [])
          .map((r, i) => (looksLikeUploadedResource(r.type, r.value) ? i : -1))
          .filter((i) => i >= 0),
      ),
  );
  const [drawCount, setDrawCount] = useState(0);
  // ADNOTARE (pas OPȚIONAL, doar în modul „upload"): autorul desenează PESTE propria imagine ca să
  // explice ceva. `annotating` = editorul e deschis; `annotationStrokes` = ce a confirmat cu „Gata"
  // (sursa de adevăr trimisă la server — nu citim ref-ul canvasului după ce se demontează).
  const [annotating, setAnnotating] = useState(false);
  // La editare, cu adnotare EXISTENTĂ (2026-08-11): pornim din desenul/nota deja salvate — „Editează
  // adnotarea" nu pleacă de la zero. `annotationSketchId` (hidden field mai jos) distinge pt server
  // create vs update: gol = adnotare nouă (`createAnnotation`), altfel = înlocuiește pe loc (`updateAnnotation`).
  const [annotationStrokes, setAnnotationStrokes] = useState<Stroke[] | null>(
    initial?.annotation?.strokes ?? null,
  );
  const [annotationCount, setAnnotationCount] = useState(initial?.annotation?.strokes.length ?? 0);
  // Adnotarea are desen ÎN AFARA imaginii (pasteboard, 2026-09-01)? → previzualizarea nu mai poate fi
  // „imagine la mărime + overlay"; lasă `SketchViewer` să randeze tot, într-o cutie cu raportul
  // extent-ului (altfel desenul din jur se taie — problema din încercarea din 2026-08-31).
  const annotationIsPasteboard =
    !!annotationStrokes && annotationStrokes.length > 0 && !isUnitExtent(computeExtent(annotationStrokes));
  // `preview.url` e mereu un `blob:` (URL.createObjectURL pe fișierul ales local). Gardă de schemă
  // explicită pe o variabilă locală înainte de a-l folosi ca `src` — orice alt scheme ar fi
  // bug/tamper, nu conținut de randat (și taie fals-pozitivul CodeQL `js/xss-through-dom`).
  const rawPreviewUrl = preview?.url ?? "";
  const previewSrc = rawPreviewUrl.startsWith("blob:") ? rawPreviewUrl : "";
  // Explicația în CUVINTE a adnotării, separată de desen (același model ca `note` la schițe, 2026-07-16).
  // Până la 2026-08-02 se putea scrie doar din editorul de schiță, deși coloana exista și se afișa —
  // autorul care adnota la publicare nu avea unde s-o scrie. `annotating` o ține în editor, lângă desen.
  const [annotationNote, setAnnotationNote] = useState(initial?.annotation?.note ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(initial?.categoryIds ?? []);
  // Pill „România" / „Altă locație" — la editare, dacă locația salvată nu e România, pornim direct
  // pe pillul „Altă locație" cu textul deja completat (formularul reflectă starea reală salvată).
  const isInitialRomania = !initial || initial.location === DEFAULT_LOCATION;
  const [isRomania, setIsRomania] = useState(isInitialRomania);
  const [locationText, setLocationText] = useState(isInitialRomania ? "" : (initial?.location ?? ""));
  // Semnalăm serverului dacă imaginea s-a schimbat efectiv (la editare) → reprocesare doar atunci.
  const [imageChanged, setImageChanged] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const imageUrlRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<SketchCanvasHandle>(null);
  const annotationCanvasRef = useRef<SketchCanvasHandle>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // La editare fără schimbare de imagine, trimitem URL-ul existent (deja procesat) → onSubmit trece
  // direct, fără re-upload. Îl punem în câmpul ascuns la montare.
  useEffect(() => {
    if (initial?.imageUrl && imageUrlRef.current && !imageUrlRef.current.value) {
      imageUrlRef.current.value = initial.imageUrl;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Eroarea poate apărea la submit când userul e derulat jos în formular (ex. secțiunea de categorii) —
  // fără scroll aici mesajul rămâne invizibil deasupra, în afara viewport-ului.
  useEffect(() => {
    if (clientError ?? state.error ?? draftState.error) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [clientError, state.error, draftState.error]);

  // Comutarea sursei resetează starea celeilalte + URL-ul deja urcat (evită trimiterea unei imagini vechi).
  function switchMode(next: "upload" | "draw" | "canvas") {
    if (next === mode) return;
    setMode(next);
    setClientError(null);
    setImageChanged(true); // comutarea sursei = imagine nouă (la editare → reprocesare pe server)
    discardAnnotation(); // „Desenează" e deja desen propriu — adnotarea peste el n-are sens
    if (imageUrlRef.current) imageUrlRef.current.value = "";
    if (next === "draw" || next === "canvas") removeImage();
  }

  // Decupajul dintr-o planșă (§7) intră EXACT ca un upload normal — evită duplicarea logicii de submit
  // din `onSubmit` (care deja urcă `imageFile` în Blob pentru mode "upload").
  function applyCanvasCrop(file: File) {
    setImageFile(file);
    setPreview({ url: URL.createObjectURL(file), name: "decupaj din planșă" });
    setImageChanged(true);
    discardAnnotation();
    if (imageUrlRef.current) imageUrlRef.current.value = "";
    setMode("upload");
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setImageFile(null);
      return;
    }
    // Validare client = doar UX (serverul impune tipul/mărimea la emiterea tokenului de upload).
    if (isHeicFile(file)) {
      setClientError(HEIC_ERROR_MESSAGE);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
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
    discardAnnotation(); // imagine nouă → adnotarea veche nu se mai potrivește peste ea
    if (imageUrlRef.current) imageUrlRef.current.value = ""; // imagine nouă → forțează re-upload
  }
  // Adnotarea e desenată PESTE o anumită imagine (coordonate normalizate față de ea). Dacă imaginea
  // se schimbă sau dispare, stroke-urile n-ar mai însemna nimic peste noua imagine → le aruncăm.
  function discardAnnotation() {
    setAnnotating(false);
    setAnnotationStrokes(null);
    setAnnotationCount(0);
    setAnnotationNote("");
  }

  function removeImage() {
    setPreview(null);
    setImageFile(null);
    discardAnnotation();
    if (fileRef.current) fileRef.current.value = "";
    if (imageUrlRef.current) imageUrlRef.current.value = "";
  }

  // Imaginea se urcă DIRECT în Blob înainte de a trimite formularul (ocolește limita de body a
  // server action-ului). Flux: 1) submit → urc imaginea → pun URL-ul în câmpul ascuns → re-submit
  // (cu ACELAȘI submitter, ca intenția — publică/ciornă — să nu se piardă); 2) la al doilea submit
  // URL-ul există → lăsăm server action-ul să proceseze.
  // „Salvează ciornă" (data-intent="draft" pe buton) relaxează regulile stricte (categorie/imagine/
  // desen obligatorii) — validarea lenientă rămâne pe server (`validateDetailInput({strict:false})`).
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const isDraftSubmit = submitter?.dataset.intent === "draft";

    // URL deja urcat (al doilea submit, sau editare fără schimbare de imagine) → lăsăm să treacă.
    if (imageUrlRef.current?.value) return;

    if (!isDraftSubmit && categoryIds.length === 0) {
      e.preventDefault();
      setClientError("Alege cel puțin o categorie.");
      return;
    }

    // MOD DESEN: randăm foaia în PNG (client) → urcăm în Blob → re-submit cu URL-ul.
    if (mode === "draw") {
      if (drawCount === 0) {
        if (isDraftSubmit) return; // ciornă fără desen încă — trece direct, fără imagine
        e.preventDefault();
        setClientError("Desenează detaliul înainte de a-l publica.");
        return;
      }
      e.preventDefault();
      if (uploading) return;
      setUploading(true);
      setClientError(null);
      try {
        const blob = await canvasRef.current?.exportThumbnail();
        if (!blob) throw new Error("export");
        const file = new File([blob], "detaliu.png", { type: "image/png" });
        const url = await uploadImageToBlob("details", file);
        if (imageUrlRef.current) imageUrlRef.current.value = url;
        formRef.current?.requestSubmit(submitter ?? undefined);
      } catch {
        setClientError(
          (await isSessionAlive()) ? "Salvarea desenului a eșuat. Încearcă din nou." : SESSION_EXPIRED_MESSAGE,
        );
      } finally {
        setUploading(false);
      }
      return;
    }

    // MOD UPLOAD: imaginea se urcă DIRECT în Blob înainte de submit (ocolește limita de body).
    if (!imageFile) {
      if (isDraftSubmit) return; // ciornă fără imagine încă — trece direct
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
      formRef.current?.requestSubmit(submitter ?? undefined);
    } catch (err) {
      if (err instanceof HeicUnsupportedError) {
        setClientError(HEIC_ERROR_MESSAGE);
      } else {
        setClientError(
          (await isSessionAlive()) ? "Încărcarea imaginii a eșuat. Încearcă din nou." : SESSION_EXPIRED_MESSAGE,
        );
      }
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
    setUploadedResourceIndices((s) => new Set([...s].filter((x) => x !== i)));
  }
  // „Schimbă" din previzualizarea compactă (sau tipul rândului s-a schimbat): revine la câmpul de
  // text/upload, golind valoarea veche.
  function clearUploadedResource(i: number) {
    updateResource(i, { value: "" });
    setUploadedResourceIndices((s) => new Set([...s].filter((x) => x !== i)));
  }

  // Upload direct de fișier pentru resurse PDF/CAD (alternativă la lipirea unui link extern).
  const [resourceUploadingIndex, setResourceUploadingIndex] = useState<number | null>(null);
  const [resourceUploadError, setResourceUploadError] = useState<Record<number, string>>({});
  async function handleResourceFile(i: number, type: ResourceType, file: File) {
    const maxBytes = type === "CAD" ? MAX_CAD_BYTES : type === "PDF" ? MAX_DOC_BYTES : MAX_IMAGE_BYTES;
    const limitLabel = resourceUploadLimitLabel(type);
    if (type === "IMAGE" && isHeicFile(file)) {
      setResourceUploadError((e) => ({ ...e, [i]: HEIC_ERROR_MESSAGE }));
      return;
    }
    if (type === "IMAGE" && !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setResourceUploadError((e) => ({ ...e, [i]: "Imaginea trebuie să fie PNG, JPG, WebP sau AVIF." }));
      return;
    }
    if (file.size > maxBytes) {
      setResourceUploadError((e) => ({ ...e, [i]: `Fișier prea mare (${limitLabel}).` }));
      return;
    }
    setResourceUploadingIndex(i);
    setResourceUploadError((e) => ({ ...e, [i]: "" }));
    try {
      const url =
        type === "IMAGE"
          ? await uploadImageToBlob("resources", file, "image")
          : await uploadDocToBlob("resources", file, type === "CAD" ? "cad" : "pdf");
      updateResource(i, { value: url });
      setUploadedResourceIndices((s) => new Set(s).add(i));
    } catch (err) {
      const message =
        err instanceof HeicUnsupportedError
          ? HEIC_ERROR_MESSAGE
          : (await isSessionAlive())
            ? "Încărcarea a eșuat. Încearcă din nou."
            : SESSION_EXPIRED_MESSAGE;
      setResourceUploadError((e) => ({ ...e, [i]: message }));
    } finally {
      setResourceUploadingIndex(null);
    }
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
      {/* Adnotarea OPȚIONALĂ a autorului peste propria imagine (stroke-uri normalizate 0..1).
          Gol = fără adnotare; serverul validează structura (`validateStrokes`) și authz. */}
      <input
        type="hidden"
        name="annotationStrokes"
        value={annotationStrokes ? JSON.stringify(annotationStrokes) : ""}
      />
      {/* Nota merge doar dacă există un desen — o explicație fără adnotare n-ar avea unde să apară. */}
      <input
        type="hidden"
        name="annotationNote"
        value={annotationStrokes ? annotationNote : ""}
      />
      {/* Editare: id-ul detaliului + semnal dacă imaginea s-a schimbat (pt reprocesare pe server). */}
      {isEdit && <input type="hidden" name="detailId" value={initial.detailId} />}
      {isEdit && <input type="hidden" name="imageChanged" value={imageChanged ? "1" : "0"} />}
      {/* Distinge create vs update pt adnotare (2026-08-11): gol = adnotare nouă, altfel = înlocuiește
          pe loc rândul existent (`updateAnnotation`, nu poate crea al doilea — MAX_ANNOTATIONS_PER_DETAIL). */}
      {isEdit && (
        <input type="hidden" name="annotationSketchId" value={initial.annotation?.id ?? ""} />
      )}
      {projectId && <input type="hidden" name="projectId" value={projectId} />}

      {(clientError ?? state.error ?? draftState.error) && (
        <p
          ref={errorRef}
          role="alert"
          className="mb-5 scroll-mt-24 rounded-[10px] border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          {clientError ?? state.error ?? draftState.error}
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

        {/* LOCAȚIE: pill România (context tehnic RO valabil) / Altă locație (text liber țară+oraș,
            context tehnic ascuns — nu are sens să clasifici un detaliu din altă țară cu valori RO). */}
        <div>
          <label className={labelClass}>Locație</label>
          <div className="mb-3 inline-flex rounded-[10px] border border-[#e6ddcf] bg-[#f6ede4] p-1">
            {([
              { key: true, label: "România" },
              { key: false, label: "Altă locație" },
            ] as const).map(({ key, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => setIsRomania(key)}
                aria-pressed={isRomania === key}
                className={cn(
                  "rounded-[7px] px-3.5 py-2 font-heading text-[13.5px] font-semibold transition-colors",
                  isRomania === key
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {!isRomania && (
            <input
              type="text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              maxLength={LOCATION_MAX_LENGTH}
              placeholder="Țară, oraș"
              className={cn(fieldClass, "mb-3")}
            />
          )}
          <input type="hidden" name="location" value={isRomania ? DEFAULT_LOCATION : locationText} />
        </div>

        {/* CONTEXT TEHNIC: zonă climatică, seismică (a_g + Tc), încărcare zăpadă/vânt — DOAR pt România
            (enforce și pe server, vezi validateDetailInput). */}
        {isRomania && (
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
        )}

        {/* IMAGINEA 2D */}
        <div className="border-t border-[#eee6da] pt-6">
          <label className={labelClass}>
            Imaginea 2D a detaliului <Req />
          </label>

          {/* Alege sursa: încarci un fișier gata făcut, desenezi detaliul pe loc, sau decupezi dintr-o
              planșă proprie deja salvată (§7, doar la creare — myCanvases absent la editare). */}
          <div className="mb-3 inline-flex rounded-[10px] border border-[#e6ddcf] bg-[#f6ede4] p-1">
            {([
              { key: "upload", label: "Încarcă fișier", Icon: Upload },
              { key: "draw", label: "Desenează", Icon: Pencil },
              ...(myCanvases ? [{ key: "canvas", label: "Dintr-o planșă", Icon: LayoutGrid }] as const : []),
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
          ) : mode === "canvas" ? (
            <CanvasCropPicker
              canvases={myCanvases ?? []}
              onApply={applyCanvasCrop}
              onCancel={() => switchMode("upload")}
            />
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
              {!annotating && (
                <div className="absolute right-3 top-3 z-[2] flex gap-2">
                  {/* 2026-08-11: adnotarea e editabilă și la editarea unui detaliu PUBLICAT
                      (`updateDetailAction` citește `annotationStrokes`/`annotationSketchId` — vezi
                      edit/actions.ts), la fel ca titlul/descrierea. Vezi `canAnnotate` mai sus pt de ce
                      fluxul de „Continuă ciorna" rămâne exclus. */}
                  {canAnnotate && (
                    <button
                      type="button"
                      onClick={() => setAnnotating(true)}
                      data-testid="annotate-open"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8bfae] bg-white/90 px-2.5 py-1.5 font-heading text-[12.5px] font-semibold text-[#95492e]"
                    >
                      <Pencil className="size-3" strokeWidth={1.9} />
                      {annotationStrokes ? "Editează adnotarea" : "Adnotează"}
                    </button>
                  )}
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
              )}
              {annotating ? (
                // Editorul de adnotare, PESTE imaginea încărcată (SketchCanvas primește preview-ul
                // local ca imagine-mamă). Stroke-urile se citesc din ref DOAR la „Gata", cât canvasul
                // e încă montat — nu după, vezi capcana `ref` din bloc condiționat (CLAUDE.md).
                <div className="relative z-[1]">
                  <div className="flex h-[60vh] max-h-[640px] min-h-[420px] overflow-hidden rounded-t-[13px] bg-[#efece6]">
                    <SketchCanvas
                      ref={annotationCanvasRef}
                      imageUrl={previewSrc}
                      initialStrokes={annotationStrokes ?? []}
                      onStrokesCount={setAnnotationCount}
                    />
                  </div>
                  <div className="border-t border-[#eee6da] bg-card px-3.5 pt-2.5">
                    <label
                      htmlFor="annotationNoteField"
                      className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[#a59a88]"
                    >
                      Explicația ta, în cuvinte (opțional)
                    </label>
                    <textarea
                      id="annotationNoteField"
                      data-testid="annotate-note"
                      value={annotationNote}
                      onChange={(e) => setAnnotationNote(e.target.value.slice(0, MAX_SKETCH_NOTE_LENGTH))}
                      maxLength={MAX_SKETCH_NOTE_LENGTH}
                      rows={2}
                      placeholder="Ex.: săgeata arată sensul de scurgere; cota e măsurată la fața finită."
                      className="w-full resize-none rounded-lg border border-[#e6dccd] bg-card px-3 py-2 text-[13.5px] leading-relaxed text-foreground placeholder:text-[#bdb3a2]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 bg-card px-3.5 py-2.5">
                    <span className="mr-auto font-mono text-[11.5px] text-muted-foreground">
                      {annotationCount === 0
                        ? "Desenează peste imagine ce vrei să explici."
                        : `${annotationCount} ${annotationCount === 1 ? "traseu" : "trasee"}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAnnotating(false)}
                      className="rounded-lg border border-[#e6dccd] bg-card px-3 py-1.5 font-heading text-[12.5px] font-semibold text-foreground/80"
                    >
                      Renunță
                    </button>
                    <button
                      type="button"
                      data-testid="annotate-save"
                      onClick={() => {
                        const strokes = annotationCanvasRef.current?.getStrokes() ?? [];
                        // Stroke-urile călătoresc BRUT în body-ul server action-ului (spre deosebire de
                        // modul „Desenează", care urcă un PNG în Blob și trimite doar URL-ul). Peste
                        // limita de body a acțiunii, publicarea ÎNTREAGĂ ar pica opac — deci refuzăm
                        // adnotarea aici, cu mesaj clar, în loc să pierdem detaliul la submit.
                        if (
                          strokes.length > 0 &&
                          new Blob([JSON.stringify(strokes)]).size > MAX_ANNOTATION_BYTES
                        ) {
                          setClientError(
                            "Adnotarea e prea complexă ca să fie salvată. Șterge din trasee și încearcă din nou.",
                          );
                          return;
                        }
                        setClientError(null);
                        setAnnotationStrokes(strokes.length > 0 ? strokes : null);
                        setAnnotating(false);
                      }}
                      className="rounded-lg border border-[#95492e] bg-primary px-3 py-1.5 font-heading text-[12.5px] font-bold text-primary-foreground"
                    >
                      Gata
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative z-[1] flex items-center justify-center p-6">
                  {/* Previzualizarea arată imaginea CU adnotarea suprapusă, prin exact componenta care
                      randează adnotarea pe pagina detaliului publicat (SketchViewer) — altfel, după
                      „Gata", userul vedea poza goală și credea că desenul s-a pierdut (nu se pierduse,
                      doar nu se randa). Fundal semitransparent implicit (2026-08-11): adnotarea e o
                      schiță ca oricare alta — aceeași regulă ca pe pagina finală.
                      Wrapper-ul `relative inline-block` se mulează exact pe imaginea randată, deci
                      dreptunghiul măsurat de SketchViewer coincide cu imaginea. */}
                  {annotationIsPasteboard ? (
                    // Desen în afara imaginii → SketchViewer randează imaginea + desenul din jur,
                    // într-o cutie de înălțime fixă (raportul extent-ului îl calculează el).
                    <div className="relative h-80 w-full max-w-xl">
                      <SketchViewer imageUrl={previewSrc} strokes={annotationStrokes!} />
                    </div>
                  ) : (
                    <span className="relative inline-block max-w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element -- preview local (blob:), nu asset optimizabil */}
                      <img
                        src={previewSrc}
                        alt="Previzualizare detaliu"
                        className="max-h-80 w-auto max-w-full object-contain"
                      />
                      {annotationStrokes && annotationStrokes.length > 0 && (
                        <SketchViewer imageUrl={previewSrc} strokes={annotationStrokes} />
                      )}
                    </span>
                  )}
                </div>
              )}
              {!annotating && (
                <div className="relative z-[2] flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[#eee6da] bg-card px-3.5 py-2.5">
                  <Send className="size-3.5 rotate-0 text-[#7a8a3f]" strokeWidth={1.9} />
                  <span className="truncate font-mono text-[12px] text-muted-foreground">
                    {preview.name}
                  </span>
                  {/* DE CE să adnotezi — scris explicit, nu lăsat pe seama iconiței: fără asta userul
                      vede un buton „Adnotează" și nu știe la ce i-ar folosi. Dispare odată adnotat. */}
                  {canAnnotate &&
                    (annotationStrokes ? (
                      <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11.5px] text-[#95492e]">
                        <Pencil className="size-3" strokeWidth={2} />
                        adnotare adăugată
                      </span>
                    ) : (
                      <span className="w-full font-mono text-[11.5px] leading-relaxed text-[#a59a88]">
                        Vrei să explici ceva anume din imagine? Apasă „Adnotează” și desenează peste ea —
                        săgeți, cote, notițe. Opțional.
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RESURSE SUPLIMENTARE */}
        <div className="border-t border-[#eee6da] pt-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <label className={cn(labelClass, "mb-0")}>
              Alte resurse <Opt />
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
            <div className="mb-3 flex flex-col gap-2.5" data-testid="resources-list">
              {resources.map((r, i) => {
                const isUploaded = uploadedResourceIndices.has(i) && r.value.trim().length > 0;
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-[132px] flex-none">
                        <select
                          value={r.type}
                          aria-label={`Tip resursă ${i + 1}`}
                          onChange={(e) => {
                            clearUploadedResource(i);
                            updateResource(i, { type: e.target.value as ResourceType });
                          }}
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
                      {isUploaded ? (
                        // Previzualizare compactă — NU link-ul kilometric (2026-08-16, raportat:
                        // „dacă văd un link kilometric nu știu ce e cu el"). Pătrățel mic ca semn că a
                        // urcat: thumbnail real pentru IMAGE, iconiță pentru PDF/CAD (nimic de previzualizat).
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          {r.type === "IMAGE" ? (
                            <div className="relative size-[38px] flex-none overflow-hidden rounded-[9px] border border-input bg-card">
                              <Image src={r.value} alt="" fill sizes="38px" unoptimized className="object-cover" />
                            </div>
                          ) : (
                            <div className="inline-flex size-[38px] flex-none items-center justify-center rounded-[9px] border border-input bg-card">
                              <FileCheck className="size-4 text-emerald-600" strokeWidth={2} />
                            </div>
                          )}
                          <span className="truncate text-[13px] text-muted-foreground">Încărcat</span>
                          <button
                            type="button"
                            onClick={() => clearUploadedResource(i)}
                            className="shrink-0 font-mono text-[11px] text-primary underline-offset-2 hover:underline"
                          >
                            Schimbă
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={r.value}
                          onChange={(e) => updateResource(i, { value: e.target.value })}
                          placeholder={resourcePlaceholder(r.type)}
                          className={cn(fieldClass, "min-w-0 flex-1 px-3 py-2.5 text-[13.5px]")}
                        />
                      )}
                      {!isUploaded && UPLOADABLE_RESOURCE_TYPES.has(r.type) && (
                        <label
                          className={cn(
                            "inline-flex size-[38px] flex-none cursor-pointer items-center justify-center rounded-[9px] border border-input bg-card transition-colors hover:border-primary",
                            resourceUploadingIndex === i && "pointer-events-none opacity-60",
                          )}
                          title={`Încarcă fișier (${resourceUploadLimitLabel(r.type)})`}
                        >
                          <Upload className="size-3.5 text-muted-foreground" strokeWidth={2} />
                          <input
                            type="file"
                            accept={resourceFileAccept(r.type)}
                            className="hidden"
                            disabled={resourceUploadingIndex !== null}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (file) void handleResourceFile(i, r.type, file);
                            }}
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        onClick={() => removeResource(i)}
                        aria-label="Elimină resursa"
                        className="inline-flex size-[38px] flex-none items-center justify-center rounded-[9px] border border-input bg-card transition-colors hover:border-destructive"
                      >
                        <X className="size-3.5 text-destructive" strokeWidth={2} />
                      </button>
                    </div>
                    {resourceUploadingIndex === i && (
                      <span className="pl-[144px] font-mono text-[11px] text-muted-foreground">
                        Se încarcă…
                      </span>
                    )}
                    {resourceUploadError[i] && (
                      <span className="pl-[144px] font-mono text-[11px] text-destructive">
                        {resourceUploadError[i]}
                      </span>
                    )}
                  </div>
                );
              })}
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
          {saveDraftAction
            ? "Nu ești gata de publicat? Salvează ciornă și continui mai târziu, din „Ciornele mele”."
            : isEdit
              ? "Modificările apar imediat pe pagina detaliului."
              : "Detaliul devine public imediat — fără coadă de aprobare. Comunitatea îl validează pe roluri."}
        </span>
      </div>

      <div className="mt-4 flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">
        <Link
          href={
            isEdit
              ? saveDraftAction
                ? "/sketches/drafts" // editare CIORNĂ — /details/[id] public nu există încă
                : `/details/${initial.detailId}`
              : "/feed"
          }
          className="inline-flex items-center justify-center rounded-[10px] border border-[#d8cfc0] bg-card px-5 py-3 font-heading text-[15px] font-semibold transition-colors hover:border-primary"
        >
          Renunță
        </Link>
        {saveDraftAction && (
          <button
            type="submit"
            formAction={draftFormAction}
            data-intent="draft"
            disabled={pending || draftPending || uploading}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#d8cfc0] bg-card px-5 py-3 font-heading text-[15px] font-semibold text-foreground transition-colors hover:border-primary disabled:opacity-60"
          >
            <Save className="size-4" strokeWidth={1.9} />
            {draftPending ? "Se salvează…" : "Salvează ciornă"}
          </button>
        )}
        <button
          type="submit"
          disabled={pending || draftPending || uploading}
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
