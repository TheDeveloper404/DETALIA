"use client";

import { Activity, Check, MapPin, Pencil, Snowflake, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailProductTour } from "@/components/detail-product-tour";
import { RolePill } from "@/components/role-pill";
import { SketchViewer } from "@/components/sketch/sketch-viewer";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DEFAULT_LOCATION } from "@/server/domain/detail";
import { REMOVED_PROJECT_AUTHOR_LABEL } from "@/server/domain/project";
import {
  composeStackStrokes,
  REMOVED_AUTHOR_LABEL,
  resolveSketchDeletionMode,
  resolveStackLayers,
} from "@/server/domain/sketch";
import type { Stroke } from "@/server/domain/sketch";
import type { ValidationPosition } from "@/server/domain/validation";
import type { TargetComment } from "@/server/repos/commentsRepo";
import type { SupplierOfferRow } from "@/server/repos/supplierOffersRepo";
import type { TargetPosition } from "@/server/repos/validationsRepo";


import { CommentsSection, type MentionSketch } from "./comments-section";
import { DetailActionsMenu } from "./detail-actions-menu";
import { deleteSketchAction, startSketchAction } from "./sketch-review-actions";
import type { ExistingMaterialOffer } from "./material-offer-modal";
import { MaterialOfferPanel } from "./material-offer-panel";
import { SupplierOfferButton, SupplierOfferPanel } from "./supplier-offer-panel";
import type { MaterialOfferForDetail } from "@/server/repos/materialOffersRepo";
import { ValidationPanel } from "./validation-panel";

// Antetul detaliului (titlu/autor/params/descriere) — mutat în capul cardului workspace (model 3.jpeg).
export type DetailHeader = {
  title: string;
  description: string | null;
  createdAt: Date;
  categories: { id: string; name: string }[];
  location: string;
  climateZone: string | null;
  seismicAg: string;
  seismicTc: string;
  snowLoad: string;
  windLoad: string;
  isSaved: boolean;
};

export type ValidationView = {
  counts: { approve: number; disapprove: number };
  myPosition: ValidationPosition | null;
  positions: TargetPosition[];
};

// Autorul unei ținte (detaliu sau schiță) — pt panoul din dreapta.
type Author = {
  id: string | null;
  name: string | null;
  image: string | null;
  roleMain: string | null;
  subRole: string | null;
  verification: string | null;
};

// O schiță din teanc, cu validarea ei (comentariile NU mai sunt per-schiță — dezbaterea e unificată).
export type WorkspaceSketch = {
  id: string;
  author: Author;
  strokes: Stroke[];
  // Explicație în cuvinte a autorului, SEPARATĂ de desen (2026-07-16) — vezi sketch-editor.tsx.
  note: string | null;
  validation: ValidationView;
  // Ordinalul „schița N" trebuie să fie STABIL în timp (prima creată = 1, mereu) — vezi comentariul de
  // la calculul `label` mai jos. Nu confunda cu ordinea de afișare a taburilor (cea mai nouă primă).
  createdAt: Date;
  // Foile peste care s-a desenat această schiță, de jos în sus (stack de foi, 2026-08-08). Goală =
  // pornită de pe detaliul gol. Id-urile pot referi foi dispărute între timp — randarea le sare.
  baseSketchIds: string[];
  // Identitatea autorului a fost RETRASĂ (ștergere parțială pe o foaie blocată). Numele/poza/id-ul vin
  // deja mascate din repo; flagul spune UI-ului să afișeze „Autor șters" în loc de „Anonim", care ar
  // sugera un cont fără nume, nu o retragere deliberată. Rolul rămâne, din snapshot.
  authorRemoved: boolean;
  // Setat când altcineva a publicat o schiță peste asta → ștergerea nu mai poate fi completă.
  // UI-ul îl folosește ca să spună DINAINTE ce face butonul (aceeași regulă ca pe server).
  lockedAt: Date | null;
};

// Workspace unificat cu taburi (model „GitHub PR"): tab 0 = detaliul de bază, tab i = schiță peste mamă.
// Validarea e CONTEXTUALĂ pe tabul activ (per-țintă, model neschimbat). Dezbaterea e UN SINGUR fir pe
// toată postarea (target DETAIL), cu @mention care sare la tabul unei schițe. Comutarea de tab e pur
// client (toate view-urile vin precomputate din server) — mutațiile revalidează pagina ca înainte.
export function DetailWorkspace({
  detailId,
  imageUrl,
  header,
  detailAuthor,
  authorRemovedFromProject = false,
  detailValidation,
  isDetailAuthor,
  deletionMode,
  annotations,
  sketches,
  comments,
  currentUserId,
  currentUserName,
  currentUserImage,
  isCurrentUserFurnizor = false,
  isOfferingSupplier = false,
  supplierOffers,
  isDetailPublic,
  myMaterialOffer = null,
  materialOffers,
  tourSeen,
}: {
  detailId: string;
  imageUrl: string;
  header: DetailHeader;
  detailAuthor: Author;
  // Autorul detaliului mai e membru activ al proiectului în care a fost publicat? (doar detalii ÎNCĂ
  // private, projectId setat — vezi projectService.isDetailAuthorRemovedFromProject). Badge de
  // AFIȘARE, nu poartă de acces — numele/poza rămân vizibile, doar apartenența s-a schimbat.
  authorRemovedFromProject?: boolean;
  detailValidation: ValidationView;
  isDetailAuthor: boolean;
  // Calculat pe server (`getDeletionPreview`): ce face „Șterge" pe acest detaliu ACUM.
  deletionMode?: "HARD_DELETE" | "ANONYMIZE";
  // Turul ghidat de pe pagina de detaliu a fost arătat vreodată acestui user? (`users.seenDetailTour`).
  // `undefined` (nu userul curent, ex. teaser public) → nu se randează turul.
  tourSeen?: boolean;
  // ADNOTĂRILE AUTORULUI peste propria imagine (nu sunt schițe din teanc — vezi `isSelfAnnotation`).
  // 0..MAX_ANNOTATIONS_PER_DETAIL, în ordinea desenării. Se randează peste imaginea de bază, UNA CÂTE UNA,
  // doar la cererea cititorului (2026-08-02: imaginea de bază se vede prima; adnotarea e opțională).
  annotations: { id: string; strokes: Stroke[]; note: string | null }[];
  sketches: WorkspaceSketch[];
  comments: TargetComment[];
  currentUserId?: string | null;
  currentUserName?: string | null;
  currentUserImage?: string | null;
  isCurrentUserFurnizor?: boolean; // doar afișare condiționată — gating real e pe server
  isOfferingSupplier?: boolean;
  supplierOffers: SupplierOfferRow[];
  // Oferă materiale (2026-08-25) — restrâns la detalii PUBLICE (gating real e pe server, la fel ca mai
  // sus). Oferta proprie a furnizorului curent (pt buton „Editează") + ofertele primite (DOAR pt autor).
  isDetailPublic: boolean;
  myMaterialOffer?: ExistingMaterialOffer | null;
  materialOffers: MaterialOfferForDetail[];
}) {
  // Tab activ = null (detaliul de bază) sau id-ul unei schițe. `?sketch=<id>` din URL (dacă e prezent)
  // deschide direct pe tab-ul acela. NU un index de array (bug real, găsit 2026-08-25 din eșecul
  // `sketch.spec.ts:74`): `setTabAndUrl` face `router.replace` pe query string, care re-fetch-uiește
  // `sketches` de pe server — dacă ÎNTRE TIMP altcineva publică o schiță pe același detaliu, ordinea
  // (cea mai nouă primă) se schimbă sub tab-ul deschis, iar un index rămas fix ar arăta silențios ALTĂ
  // schiță (autor greșit, buton „Șterge" pe formularul greșit). Comparăm cu id-ul, la fel ca
  // `openAnnotation`/`layersOwnerId` mai jos: „nu mai există la id-ul ăsta" cade sigur pe tab-ul de bază.
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [activeSketchId, setActiveSketchId] = useState<string | null>(() => {
    const wanted = searchParams.get("sketch");
    if (!wanted) return null;
    return sketches.some((s) => s.id === wanted) ? wanted : null;
  });
  // Adnotarea pornește DESCHISĂ implicit (2026-08-11, decizie de produs: e „startul dezbaterii", trebuie
  // vizibilă din prima, nu ascunsă după un click). Cel mult UNA (MAX_ANNOTATIONS_PER_DETAIL = 1) —
  // `annotations[0]` dacă există. Cititorul o poate închide din butonul din colț; starea e doar de
  // afișare, fără persistență (revine deschisă la un reload).
  // (Istoric: 2026-07-31→2026-08-01 pornea vizibilă; 2026-08-02→2026-08-11 pornea închisă, până la 3.)
  // Nod DOM din bara de taburi unde `ValidationPanel` portalează controlul compact de vot (2026-08-16,
  // raportat). `useState`, nu `useRef`: un ref simplu n-ar declanșa re-render când elementul se
  // atașează la primul mount, iar portalul ar rămâne fără țintă până la următoarea randare oarecare.
  const [voteSlotEl, setVoteSlotEl] = useState<HTMLDivElement | null>(null);
  const [openAnnotationId, setOpenAnnotationId] = useState<string | null>(annotations[0]?.id ?? null);
  // Ștergerea unei adnotări (doar autorul): id-ul în așteptare de confirmare.
  const [pendingDeleteAnnotationId, setPendingDeleteAnnotationId] = useState<string | null>(null);
  // Formular MONTAT PERMANENT, în afara oricărui bloc condiționat pe stare togglabilă: dacă ar sta în
  // interiorul `{openAnnotation && ...}`, ref-ul ar deveni null când adnotarea se închide, iar submit-ul
  // din ConfirmDialog ar eșua tăcut (bugul din `detail-actions-menu.tsx`, 2026-07-16).
  const deleteAnnotationFormRef = useRef<HTMLFormElement>(null);
  // Adnotarea deschisă acum (sau null). Derivată, nu stare separată: dacă adnotarea deschisă e ștearsă,
  // lista revine fără ea de pe server și `find` întoarce undefined → UI-ul se închide singur, corect.
  const openAnnotation = annotations.find((a) => a.id === openAnnotationId) ?? null;
  const activeSketch = activeSketchId ? (sketches.find((s) => s.id === activeSketchId) ?? null) : null;
  const isBase = activeSketch === null;

  // Sincronizează URL-ul cu tab-ul activ (shallow, fără reload) — altfel bara de adresă a browserului nu
  // reflectă schița deschisă, iar „copiază link-ul din browser" (regula 2026-07-06: fără buton dedicat de
  // link privat) ar trimite mereu pe tab de bază, nu pe schița pe care o vezi.
  function setTabAndUrl(sketchId: string | null) {
    setActiveSketchId(sketchId);
    router.replace(sketchId ? `${pathname}?sketch=${sketchId}` : pathname, { scroll: false });
  }

  // Mențiunile din comentarii selectează un tab de schiță după id.
  function selectSketch(sketchId: string) {
    if (sketches.some((s) => s.id === sketchId)) setTabAndUrl(sketchId);
  }

  // Eticheta unei schițe: „Nume" sau „Nume — schița N" când același autor are mai multe. Ordinalul e
  // după data creării (prima = 1, FIX, nu se renumerotează niciodată) — NU după ordinea din `sketches`
  // (cea mai nouă primă, doar pentru afișarea taburilor). Altfel, la fiecare schiță nouă a aceluiași
  // autor, toate etichetele mai vechi s-ar renumerota (bug raportat 2026-07-07).
  // Folosită în DOUĂ locuri (taburi + bifele stack-ului) → o singură definiție, ca să nu divergă.
  function sketchLabel(s: WorkspaceSketch): string {
    // Identitate retrasă → „Autor șters", nu „Anonim": al doilea ar sugera un cont fără nume, când de
    // fapt cineva a cerut deliberat să nu mai fie legat de desen. Ordinalul dispare odată cu numele —
    // „Autor șters — schița 2" ar reconstitui exact legătura pe care userul a retras-o.
    if (s.authorRemoved) return REMOVED_AUTHOR_LABEL;
    const baseName = s.author.name ?? "Anonim";
    const sameAuthor = sketches
      .filter((x) => (x.author.name ?? "") === (s.author.name ?? ""))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return sameAuthor.length > 1
      ? `${baseName} — schița ${sameAuthor.findIndex((x) => x.id === s.id) + 1}`
      : baseName;
  }

  const mentionSketches: MentionSketch[] = sketches.map((s) => ({
    id: s.id,
    authorName: s.author.name,
    authorImage: s.author.image,
    createdAt: s.createdAt,
    authorRemoved: s.authorRemoved,
  }));

  // ── Stack de foi (2026-08-08) ──────────────────────────────────────────────────────────────────
  // Foile din fundalul schiței active care sunt APRINSE acum. Pornesc toate aprinse (= exact ce vedea
  // autorul când a desenat), iar cititorul le poate stinge liber, oricare, în orice ordine (bife
  // NEierarhice). Detaliul de bază nu are bifă — e mereu aprins.
  //
  // Stare DOAR de vizualizare, resetată la schimbarea tabului (`key`-ul derivat de mai jos): nu se
  // persistă per user — la fiecare deschidere vezi stack-ul întreg, nu o preferință veche.
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(new Set());
  // Resetăm bifele când se schimbă schița activă. Comparăm cu id-ul, nu cu indexul: după o ștergere,
  // același index poate însemna altă schiță.
  const [layersOwnerId, setLayersOwnerId] = useState<string | null>(activeSketch?.id ?? null);
  if (layersOwnerId !== (activeSketch?.id ?? null)) {
    setLayersOwnerId(activeSketch?.id ?? null);
    setHiddenLayerIds(new Set());
  }

  // Foile de fundal ale schiței active, rezolvate din id-uri în ordinea din rețetă (jos → sus) — o foaie
  // poate fi o schiță din teanc SAU adnotarea autorului, deci rezolvarea caută în ambele surse (vezi
  // `resolveStackLayers`, domain/sketch.ts, pentru istoricul bug-ului).
  const stackLayers = useMemo(() => {
    const sketchById = new Map(sketches.map((s) => [s.id, s]));
    const annotationById = new Map(annotations.map((a) => [a.id, a]));
    return resolveStackLayers(activeSketch?.baseSketchIds ?? [], sketchById, annotationById).map((r) =>
      r.source === "sketch"
        ? { id: r.id, strokes: r.layer.strokes, label: sketchLabel(r.layer) }
        : { id: r.id, strokes: r.layer.strokes, label: "adnotarea autorului" },
    );
    // `sketchLabel` nu e memoizată, dar depinde doar de `sketches` (deja în array) — includerea ei aici
    // ar recalcula la fiecare render, anulând memo-ul.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSketch, sketches, annotations]);

  // Ce se randează efectiv: foile de fundal aprinse, în ordine, apoi schița activă DEASUPRA tuturor.
  //
  // `useMemo` NU e opțional aici: `SketchViewer` are `useEffect` pe `[rect, strokes, veil]`, deci un
  // array nou la fiecare render ar reface clear + `renderStrokes` complet la ORICE re-render al
  // workspace-ului (tastare în comentarii, deschiderea unui dialog). Înainte se pasa direct
  // `activeSketch.strokes` — referință stabilă, efectul nu se re-rula. Cu un stack plin ar însemna
  // zeci de mii de stroke-uri redesenate la fiecare tastă.
  const composedStrokes = useMemo(
    () =>
      activeSketch
        ? composeStackStrokes([
            ...stackLayers
              .filter((l) => !hiddenLayerIds.has(l.id))
              .map((l) => ({ strokes: l.strokes })),
            { strokes: activeSketch.strokes },
          ])
        : [],
    [activeSketch, hiddenLayerIds, stackLayers],
  );

  function toggleLayer(id: string) {
    setHiddenLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeValidation = isBase ? detailValidation : activeSketch!.validation;
  // Din 2026-08-06: oricine autentificat poate lua poziție pe orice, INCLUSIV pe propriul conținut
  // (decizie de produs — vezi nota din validationService.approve). Singura condiție rămasă e sesiunea.
  const canValidate = !!currentUserId;
  // Ștergerea schiței active: autorul detaliului (moderare) SAU autorul schiței. Modul se calculează cu
  // ACEEAȘI funcție pură ca pe server (`resolveSketchDeletionMode`) — altfel dialogul ar promite altceva
  // decât face acțiunea. Serverul rămâne sursa de adevăr; asta e doar ce-i spunem userului dinainte.
  const activeDeletionMode = activeSketch
    ? resolveSketchDeletionMode({
        lockedAt: activeSketch.lockedAt,
        isSketchAuthor: !!currentUserId && activeSketch.author.id === currentUserId,
        isDetailAuthor,
      })
    : "FORBIDDEN";
  // Pe o foaie blocată, moderatorul nu mai are ce acțiune să ceară → nu-i arătăm un buton care refuză.
  const canDeleteActive = !!activeSketch && activeDeletionMode !== "FORBIDDEN";

  // Mutat sub imagine (nu mai suprapus peste ea) + colaps la iconiță — textul apare doar la HOVER
  // (mouse peste buton), nu la click (spre deosebire de taburile de mai sus, care se extind la click).
  // 2026-08-11: „Schițează peste" e IDENTIC pentru toată lumea, INCLUSIV autorul detaliului pe propriul
  // lui detaliu — un desen al lui aici e o schiță normală (intră în teanc), nu mai e o adnotare specială
  // (vezi domain/sketch.ts). Adnotarea propriu-zisă se creează/editează DOAR din formularul de
  // Adaugă/Editează detaliu (`createAnnotation`/`updateAnnotation`), nu de aici.
  //
  // STACK: ce se îngheață ca fundal = EXACT ce e aprins pe ecran acum. Pe tabul de bază asta poate fi
  // DOAR adnotarea, dacă e deschisă (2026-08-11, decizie de produs: e „startul dezbaterii", trebuie să
  // poată fi bază pentru o schiță nouă) — adnotarea NU se randează pe tab-urile de schiță (doar pe
  // `isBase`, vezi randarea de mai jos), deci NU intră în capturedStack de-acolo: altfel am trimite ceva
  // ce userul nu a văzut deloc pe ecran, contrazicând exact regula „ce e aprins acum".
  const capturedStack = isBase
    ? openAnnotationId
      ? [openAnnotationId]
      : []
    : [...stackLayers.filter((l) => !hiddenLayerIds.has(l.id)).map((l) => l.id), activeSketch!.id];

  // O SINGURĂ denumire peste tot („Schițează peste detaliu" vs „...ce vezi acum" complica înțelegerea,
  // 2026-08-16, raportat) — acțiunea e identică din perspectiva userului (continuă dezbaterea cu
  // ce e aprins pe ecran acum, fie detaliul singur, fie detaliul + adnotare, fie o schiță), doar
  // `capturedStack` (mai sus) diferă tehnic după context.
  const startSketchLabel = "Schițează";
  const startSketchBtn = (
    <form action={startSketchAction}>
      <input type="hidden" name="detailId" value={detailId} />
      {/* Rețeta stack-ului, ca JSON. Serverul o revalidează integral (structură + apartenență la
          detaliu + status) — clientul nu e sursă de adevăr, doar propune ce avea pe ecran. */}
      {capturedStack.length > 0 && (
        <input type="hidden" name="baseSketchIds" value={JSON.stringify(capturedStack)} />
      )}
      <Button
        type="submit"
        size="icon"
        title={startSketchLabel}
        className="group/button !w-auto gap-0 overflow-hidden !px-2.5 shadow-md"
      >
        <Pencil className="size-4 shrink-0" strokeWidth={2} />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/button:ml-2 group-hover/button:max-w-[320px] group-hover/button:opacity-100">
          {startSketchLabel}
        </span>
      </Button>
    </form>
  );

  return (
    <div className="flex flex-col gap-7">
      {tourSeen !== undefined && <DetailProductTour seen={tourSeen} />}
      {/* id=schiteaza — ținta scurtăturii „Schițează peste" din cardul de feed. */}
      <section id="schiteaza" className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card">
        {/* ANTET detaliu (titlu/autor/params/descriere) în capul cardului + „Schițează peste" sus-dreapta */}
        <div className="border-b border-[#eee6da] px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-heading text-[28px] font-extrabold leading-[1.15] tracking-tight text-balance">
              {header.title}
            </h1>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Autor retras din detaliu: fără nume, poză sau link — doar rolul (din snapshot) rămâne,
                ca discuția să păstreze contextul profesional. `id` null vine deja mascat de pe server. */}
            {detailAuthor.id ? (
              <Link
                href={`/profile/${detailAuthor.id}`}
                className="flex items-center gap-2 no-underline"
              >
                <AvatarInitials name={detailAuthor.name} imageUrl={detailAuthor.image} size={38} />
                <span className="font-heading text-[15.5px] font-bold hover:underline">
                  {detailAuthor.name ?? "Anonim"}
                </span>
              </Link>
            ) : null}
            {detailAuthor.id && authorRemovedFromProject && (
              <span className="rounded-md border border-[#ecdcc8] bg-[#f6ede4] px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
                {REMOVED_PROJECT_AUTHOR_LABEL}
              </span>
            )}
            {!detailAuthor.id && (
              <span className="flex items-center gap-2">
                <AvatarInitials name={null} imageUrl={null} size={38} />
                <span className="font-heading text-[15.5px] font-bold text-muted-foreground">
                  {REMOVED_AUTHOR_LABEL}
                </span>
              </span>
            )}
            <RolePill
              roleMain={detailAuthor.roleMain}
              subRole={detailAuthor.subRole}
              verified={detailAuthor.verification === "VERIFIED"}
            />
            {header.categories.map((c) => (
              <Link
                key={c.id}
                href={`/feed?cat=${c.id}`}
                className="rounded-md border border-[#ecdcc8] bg-[#f6ede4] px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-primary"
              >
                {c.name}
              </Link>
            ))}
            <span className="font-mono text-xs text-muted-foreground">
              · publicat {formatDate(header.createdAt)}
            </span>
            <span className="ml-auto">
              <DetailActionsMenu
                detailId={detailId}
                isAuthor={isDetailAuthor}
                isSaved={header.isSaved}
                canSendToCanvas={!!currentUserId}
                activeSketchPublicId={isBase ? null : activeSketch!.id}
                canDeleteActiveSketch={canDeleteActive}
                deletionMode={deletionMode}
                sketchDeletionMode={activeDeletionMode}
                deleteSketchLabel={
                  // Pe o foaie blocată acțiunea nu mai e „ștergere", ci retragere din dezbatere —
                  // eticheta din meniu trebuie să spună asta încă dinainte de dialogul de confirmare.
                  activeDeletionMode === "PARTIAL"
                    ? "Retrage-mă din schiță"
                    : !isBase && isDetailAuthor && activeSketch!.author.id !== currentUserId
                      ? "Șterge schița"
                      : "Șterge schița mea"
                }
              />
            </span>
          </div>

          {/* Locație — doar dacă NU e România (implicit, nu adăugăm zgomot pt cazul normal). */}
          {header.location !== DEFAULT_LOCATION && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                <MapPin className="size-3 text-[#5e6f8a]" strokeWidth={2} />
                {header.location}
              </span>
            </div>
          )}

          {/* parametri tehnici */}
          {(header.climateZone ||
            header.seismicAg !== "General" ||
            header.seismicTc !== "General" ||
            header.snowLoad !== "General" ||
            header.windLoad !== "General") && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {header.climateZone && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  <Snowflake className="size-3 text-[#5e6f8a]" strokeWidth={2} />
                  {header.climateZone}
                </span>
              )}
              {(header.seismicAg !== "General" || header.seismicTc !== "General") && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  <Activity className="size-3 text-primary" strokeWidth={2} />
                  Seismic a_g {header.seismicAg} · Tc {header.seismicTc}
                </span>
              )}
              {header.snowLoad !== "General" && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  Încărcare zăpadă {header.snowLoad}
                </span>
              )}
              {header.windLoad !== "General" && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  Încărcare vânt {header.windLoad}
                </span>
              )}
            </div>
          )}

          {header.description && (
            <div className="mt-4 whitespace-pre-wrap text-[15.5px] leading-relaxed text-foreground/80 text-pretty">
              {header.description}
            </div>
          )}
        </div>

        {/* strip taburi: [DETALIU DE BAZĂ] + avatar-only per schiță (activ = avatar+nume, tooltip la hover).
            Anti-tremur: min-h FIX (înălțimea rândului nu fluctuează cu starea pastilelor) + flex-NOWRAP
            (lărgirea pastilei active nu poate împinge pastilele pe rândul doi → fără salt de ~40px sub ele;
            la overflow se face scroll orizontal, nu wrap). */}
        {/* pb: „overflow-x-auto" transformă rândul într-un container de scroll pe ambele axe (per spec CSS,
            overflow-x != visible face overflow-y „auto" implicit) → fără padding jos, inelul avatarului
            (box-shadow) și descendentele literelor (ș/ț) se tăiau la marginea de jos. */}
        {/* Rândul exterior separă taburile scrollabile (flex-1 min-w-0, pot face scroll orizontal) de
            slot-ul de vot (shrink-0, FIX — altfel ar putea ieși din ecran la scroll pe multe taburi,
            2026-08-16, raportat: săgețile mutate aici din coloana verticală de jos). */}
        <div className="flex items-center gap-2 px-4 pb-1.5 pt-3 sm:px-5">
          <div
            data-tour="detail-tabs"
            className="flex min-h-11 min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto"
          >
            <button
              type="button"
              onClick={() => setTabAndUrl(null)}
              title={detailAuthor.name ?? "Autor detaliu"}
              aria-label={detailAuthor.name ?? "Autor detaliu"}
              aria-current={isBase ? "true" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full transition-colors",
                isBase
                  ? "bg-secondary py-1 pl-1 pr-3 ring-1 ring-primary/30"
                  : "p-0.5 opacity-70 hover:opacity-100",
              )}
            >
              <AvatarInitials
                name={detailAuthor.name}
                imageUrl={detailAuthor.image}
                size={28}
                className={cn("ring-2 transition-colors", isBase ? "ring-primary" : "ring-transparent")}
              />
              {isBase && (
                <span className="flex flex-col items-start leading-tight">
                  <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                    Autor detaliu
                  </span>
                  <span className="font-heading text-[13px] font-semibold text-foreground">
                    {detailAuthor.id ? (detailAuthor.name ?? "Anonim") : REMOVED_AUTHOR_LABEL}
                  </span>
                </span>
              )}
            </button>
            {sketches.map((s) => {
              // Eticheta e IDENTICĂ cu cea a mențiunilor din dezbatere (comments-section) — cititorul
              // le poate corela. Vezi `sketchLabel` pentru regula ordinalului stabil.
              const label = sketchLabel(s);
              const isActive = activeSketch?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`sketch-tab-${s.id}`}
                  onClick={() => setTabAndUrl(s.id)}
                  title={label}
                  aria-label={label}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full transition-colors",
                    isActive
                      ? "bg-secondary py-1 pl-1 pr-3 ring-1 ring-primary/30"
                      : "p-0.5 opacity-70 hover:opacity-100",
                  )}
                >
                  <AvatarInitials
                    name={s.author.name}
                    imageUrl={s.author.image}
                    size={28}
                    className={cn("ring-2 transition-colors", isActive ? "ring-primary" : "ring-transparent")}
                  />
                  {isActive && (
                    <span className="flex items-center gap-2">
                      <span className="font-heading text-[13px] font-semibold text-foreground">{label}</span>
                      <RolePill
                        roleMain={s.author.roleMain}
                        subRole={s.author.subRole}
                        verified={s.author.verification === "VERIFIED"}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div ref={setVoteSlotEl} className="flex shrink-0 items-center" />
        </div>

        {/* viewport (tabul activ) — panoul separat din dreapta a fost scos 2026-07-06: autorul + rolul
            erau deja afișate în antet (tab bază) / lângă tab-ul activ (tab schiță, RolePill de mai sus);
            singura info netă din panou era rolul, mutat acolo. Imaginea folosește acum toată lățimea. */}
        <div className="mt-3 border-t border-[#eee6da]">
          <div className="relative flex min-h-[420px] items-center justify-center bg-[#faf7f1] p-6">
            {/* CTA suprapus peste imagine, colț dreapta-jos (nu bară separată). */}
            <div data-tour="detail-actions" className="absolute bottom-3 right-3 z-[3] flex items-center gap-2">
              {/* „Ofertă" — DOAR pe tab-ul de bază (materialele țin de detaliu, nu de o schiță anume),
                  DOAR furnizori, NICIODATĂ pe propriul detaliu (2026-08-18, mutat lângă „Schițează").
                  DOAR pe detalii PUBLICE (2026-08-25) — pe proiecte private n-are sens comercial.
                  Click-ul (ridicare SAU click ulterior) deschide modalul de ofertă materiale — vezi
                  SupplierOfferButton. */}
              {isBase && !isDetailAuthor && isCurrentUserFurnizor && isDetailPublic && (
                <SupplierOfferButton
                  detailId={detailId}
                  isOffering={isOfferingSupplier}
                  existingOffer={myMaterialOffer}
                />
              )}
              {startSketchBtn}
            </div>
            {/* grilă + cutie 4/3 IDENTICE pe ambele taburi — altfel viewport-ul „sare" la comutare */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "linear-gradient(#ece1cd 1px,transparent 1px),linear-gradient(90deg,#ece1cd 1px,transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            {!isBase && (
              <span
                key={`badge-${activeSketch?.id ?? "base"}`}
                className="absolute left-3 top-3 z-[2] animate-in fade-in rounded-md border border-[#e6dccd] bg-white/85 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-[#7c7060] duration-200"
              >
                schiță peste detaliu
              </span>
            )}
            {/* Adnotările autorului: un buton per adnotare, în locul badge-ului de schiță. Nu sunt taburi
                și nu sunt schițe ale altcuiva; sunt notele autorului pe imaginea lui. Click = o deschide
                (închizându-le pe celelalte), al doilea click pe aceeași = o închide → imaginea curată. */}
            {isBase && annotations.length > 0 && (
              <div className="absolute left-3 top-3 z-[3] flex flex-wrap items-center gap-1.5">
                {annotations.map((a) => {
                  const isOpen = a.id === openAnnotationId;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setOpenAnnotationId(isOpen ? null : a.id)}
                      aria-pressed={isOpen}
                      data-testid="annotation-toggle-1"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors",
                        isOpen
                          ? "border-[#d8bfae] bg-white/90 text-[#95492e]"
                          : "border-[#e6dccd] bg-white/70 text-[#9c9080] hover:text-[#7c7060]",
                      )}
                    >
                      <Pencil className="size-3" strokeWidth={2} />
                      adnotarea autorului
                    </button>
                  );
                })}
                {/* Ștergerea: DOAR autorul, DOAR pe adnotarea deschisă (altfel n-ai vedea ce ștergi). */}
                {isDetailAuthor && openAnnotation && (
                  <button
                    type="button"
                    onClick={() => setPendingDeleteAnnotationId(openAnnotation.id)}
                    data-testid="annotation-delete"
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#e6dccd] bg-white/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-[#9c9080] transition-colors hover:border-[#d8a89e] hover:text-[#95492e]"
                  >
                    <Trash2 className="size-3" strokeWidth={2} />
                    șterge
                  </button>
                )}
              </div>
            )}
            <div className="relative z-[1] aspect-[4/3] w-full max-w-3xl">
              {/* imaginea-mamă rămâne PERMANENT montată (nu se remontează la comutarea taburilor —
                  altfel reîncărca async și „pocnea") ȘI mereu OPACĂ (2026-07-16 — detaliul
                  de bază nu se mai face transparent; schița e cea cu foaia semitransparentă, randată de
                  SketchViewer peste el, ca în realitate). Doar overlay-ul de schiță face fade-in la
                  comutare (opacity, FĂRĂ animație de layout — nu redeschide problema tremurului). */}
              <Image
                src={imageUrl}
                alt={header.title}
                fill
                sizes="(max-width: 1024px) 100vw, 768px"
                className="object-contain"
                priority
              />
              {!isBase && (
                <div key={`sketch-${activeSketch?.id ?? "base"}`} className="absolute inset-0 animate-in fade-in duration-200">
                  <SketchViewer imageUrl={imageUrl} strokes={composedStrokes} />
                </div>
              )}
              {/* ADNOTAREA DESCHISĂ — doar pe tabul de bază, CU văl semitransparent (2026-08-11: o
                  adnotare e o schiță ca oricare alta — fundalul translucid o face lizibilă peste
                  imaginea de bază, la fel ca la orice altă schiță). Pornește DESCHISĂ implicit
                  (2026-08-11, decizie de produs: „e startul dezbaterii" — vezi `openAnnotationId`
                  mai sus); cititorul o poate închide din butonul din colț. `key` pe id → fade-in
                  la comutarea între ele. */}
              {isBase && openAnnotation && (
                <div
                  key={`annotation-${openAnnotation.id}`}
                  className="absolute inset-0 animate-in fade-in duration-200"
                >
                  <SketchViewer imageUrl={imageUrl} strokes={openAnnotation.strokes} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nota scrisă a ADNOTĂRII DESCHISE (dacă autorul a lăsat una) — pe tabul de bază, legată de
            desenul ei. Apare și dispare odată cu desenul: e aceeași explicație, în cuvinte. */}
        {isBase && openAnnotation?.note && (
          <div className="animate-in fade-in border-t border-[#eee6da] bg-[#faf7f1] px-5 py-4 duration-200 sm:px-6">
            <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
              Adnotarea autorului
            </div>
            <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground">
              {openAnnotation.note}
            </p>
          </div>
        )}

        {/* TEANCUL DE FOI (2026-08-08) — doar când schița activă s-a construit peste altele. Fiecare
            foaie are o bifă LIBERĂ (nu ierarhică): poți stinge oricare, în orice ordine, ca să vezi
            ce a adus fiecare peste ce. Detaliul de bază NU are bifă — e mereu aprins, e subiectul. */}
        {!isBase && stackLayers.length > 0 && (
          <div
            key={`stack-${activeSketch!.id}`}
            className="animate-in fade-in border-t border-[#eee6da] bg-[#faf7f1] px-5 py-4 duration-200 sm:px-6"
          >
            <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
              Foi în teanc
            </div>
            <ul className="flex flex-wrap gap-2">
              <li>
                <span className="inline-flex cursor-default items-center gap-2 rounded-full border border-[#e2d8c8] bg-white/60 px-3 py-1.5 text-[13px] text-muted-foreground">
                  <Check className="size-3.5 shrink-0 opacity-40" aria-hidden />
                  Detaliul de bază
                </span>
              </li>
              {stackLayers.map((layer) => {
                const visible = !hiddenLayerIds.has(layer.id);
                const label = layer.label;
                return (
                  <li key={layer.id}>
                    <button
                      type="button"
                      data-testid={`stack-layer-${layer.id}`}
                      onClick={() => toggleLayer(layer.id)}
                      aria-pressed={visible}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                        visible
                          ? "border-primary/40 bg-white text-foreground"
                          : "border-[#e2d8c8] bg-transparent text-muted-foreground line-through",
                      )}
                    >
                      <Check
                        className={cn("size-3.5 shrink-0", visible ? "opacity-100" : "opacity-25")}
                        aria-hidden
                      />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Explicația autorului schiței, în cuvinte — SEPARATĂ de desen (2026-07-16). Doar pe tab de
            schiță, doar dacă autorul a scris ceva. */}
        {!isBase && activeSketch!.note && (
          <div
            key={`note-${activeSketch!.id}`}
            className="animate-in fade-in border-t border-[#eee6da] bg-[#faf7f1] px-5 py-4 duration-200 sm:px-6"
          >
            <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
              Explicația autorului
            </div>
            <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground">
              {activeSketch!.note}
            </p>
          </div>
        )}

        {/* bara de validare CONTEXTUALĂ (pe ținta tabului activ), integrată în card (butoane compacte);
            fade-in la comutare (opacity, fără animație de layout — nu redeschide tremurul) */}
        <div
          key={isBase ? "DETAIL" : activeSketch!.id}
          data-tour="detail-validation"
          className="animate-in fade-in border-t border-[#eee6da] p-5 duration-200 sm:px-6"
        >
          <ValidationPanel
            key={isBase ? "DETAIL" : activeSketch!.id}
            targetType={isBase ? "DETAIL" : "SKETCH"}
            targetId={isBase ? detailId : activeSketch!.id}
            detailId={detailId}
            allowSketch={isBase}
            canValidate={canValidate}
            counts={activeValidation.counts}
            myPosition={activeValidation.myPosition}
            positions={activeValidation.positions}
            embedded
            voteSlot={voteSlotEl}
          />
          {isBase && <SupplierOfferPanel offers={supplierOffers} />}
          {/* STRICT autor — server-ul întoarce listă goală pt oricine altcineva (dublă barieră). */}
          {isBase && isDetailAuthor && <MaterialOfferPanel offers={materialOffers} />}
        </div>
      </section>

      {/* dezbaterea unificată pe toată postarea (target DETAIL) + @mention care sare la tabul schiței */}
      <div data-tour="detail-comments">
      <CommentsSection
        targetType="DETAIL"
        targetId={detailId}
        detailId={detailId}
        comments={comments}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserImage={currentUserImage}
        mentionSketches={mentionSketches}
        onSelectSketch={selectSketch}
      />
      </div>

      {/* Ștergerea unei adnotări. Formularul stă MONTAT PERMANENT (ascuns), nu în blocul adnotării
          deschise: altfel închiderea adnotării i-ar demonta ref-ul, iar confirmarea ar eșua tăcut —
          exact bugul din `detail-actions-menu.tsx` (2026-07-16). Authz e pe server: `deleteSketch`
          cere ca actorul să fie autorul schiței sau al detaliului — butonul nu e sursă de adevăr. */}
      <form action={deleteSketchAction} ref={deleteAnnotationFormRef} className="hidden" aria-hidden>
        <input type="hidden" name="sketchId" value={pendingDeleteAnnotationId ?? ""} />
        {/* `detailId` NU e opțional: fără el `deleteSketchAction` revalidează „/details/" (cale greșită)
            → adnotarea ștearsă rămâne pe ecran până la un reload manual. */}
        <input type="hidden" name="detailId" value={detailId} />
      </form>
      <ConfirmDialog
        open={!!pendingDeleteAnnotationId}
        title="Ștergi adnotarea?"
        message="Desenul și nota ei dispar definitiv de pe detaliu. Detaliul și schițele primite de la alții rămân neatinse."
        onConfirm={() => {
          deleteAnnotationFormRef.current?.requestSubmit();
          setPendingDeleteAnnotationId(null);
        }}
        onCancel={() => setPendingDeleteAnnotationId(null)}
      />
    </div>
  );
}
