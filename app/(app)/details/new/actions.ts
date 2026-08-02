"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { reprocessBlobImage } from "@/lib/image-processing";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { getPostHogClient } from "@/lib/posthog-server";
import { requireActiveUserId } from "@/lib/require-active-user";
import { isOwnBlobUrl } from "@/lib/blob-url";
import { type DetailResourceInput, isValidResourceType } from "@/server/domain/detail";
import { createDetail, createDetailDraft } from "@/server/services/detailService";
import { createAnnotation } from "@/server/services/sketchService";

export type CreateDetailState = { error: string | null };

// Stroke-urile adnotării vin ca JSON dintr-un câmp ascuns (desenate pe client peste previzualizare).
// Aici doar decodăm forma brută — structura o validează `validateStrokes` din domain, pe server.
// null = fără adnotare (câmp gol/absent/malformat) → publicarea decurge normal, e un pas OPȚIONAL.
function parseAnnotationStrokes(raw: FormDataEntryValue | null): unknown[] | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

// Resursele suplimentare vin ca JSON dintr-un câmp ascuns (repeater pe client). Parsare defensivă:
// ignorăm orice e malformat sau cu valoare goală; validarea finală o face DetailService.
function readResources(formData: FormData): DetailResourceInput[] {
  const raw = formData.get("resources");
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is { type: string; url: string } =>
          typeof r === "object" &&
          r !== null &&
          typeof (r as { type?: unknown }).type === "string" &&
          typeof (r as { url?: unknown }).url === "string" &&
          (r as { url: string }).url.trim().length > 0,
      )
      .filter((r) => isValidResourceType(r.type))
      .slice(0, 3)
      .map((r) => ({ type: r.type as DetailResourceInput["type"], url: r.url.trim() }));
  } catch {
    return [];
  }
}

// Mesaje prietenoase (fără internals). Acoperă erorile din storage + DetailService.
const ERROR_MESSAGES: Record<string, string> = {
  EMPTY: "Alege o imagine pentru detaliu.",
  INVALID_TYPE: "Imaginea trebuie să fie PNG, JPG, WebP sau AVIF.",
  TOO_LARGE: "Imaginea e prea mare (max 8 MB).",
  UPLOAD_FAILED: "Stocarea imaginilor nu e disponibilă acum (config Blob).",
  TITLE_REQUIRED: "Titlul e obligatoriu.",
  TITLE_TOO_LONG: "Titlul e prea lung (max 200 de caractere).",
  DESCRIPTION_TOO_LONG: "Textul e prea lung (max 5000 de caractere).",
  IMAGE_REQUIRED: "Alege o imagine pentru detaliu.",
  CATEGORY_REQUIRED: "Alege cel puțin o categorie.",
  TOO_MANY_CATEGORIES: "Prea multe categorii bifate.",
  INVALID_ZONE: "Una dintre valorile de zonă/încărcare nu e validă.",
  LOCATION_REQUIRED: "Completează țara și orașul.",
  LOCATION_TOO_LONG: "Locația e prea lungă (max 200 de caractere).",
  INVALID_CATEGORY: "Una dintre categoriile alese nu există.",
  TOO_MANY_RESOURCES: "Prea multe resurse atașate (max 3).",
  INVALID_RESOURCE: "O resursă atașată e invalidă.",
  RATE_LIMITED: "Prea multe detalii publicate într-un timp scurt. Încearcă mai târziu.",
};

export async function createDetailAction(
  _prev: CreateDetailState,
  formData: FormData,
): Promise<CreateDetailState> {
  // Deny-by-default: doar useri autentificați. authorId vine EXCLUSIV din sesiune, niciodată din client.
  // SEC-04: re-check status proaspăt din DB (sesiune JWT stale) — cont suspendat nu poate publica detalii.
  const userId = await requireActiveUserId();

  // SEC-01: publicarea e costisitoare (imagine + scrieri DB) → limită dedicată per user.
  if (!(await checkLimit(limiters.createDetail, userId)).ok) {
    return { error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);
  const location = String(formData.get("location") ?? "");
  const climateZone = String(formData.get("climateZone") ?? "");
  const seismicAg = String(formData.get("seismicAg") ?? "");
  const seismicTc = String(formData.get("seismicTc") ?? "");
  const snowLoad = String(formData.get("snowLoad") ?? "");
  const windLoad = String(formData.get("windLoad") ?? "");
  const resources = readResources(formData);

  // Guard ieftin înainte de upload — evită blob-uri orfane dacă lipsesc câmpurile text.
  if (title.trim().length === 0) return { error: ERROR_MESSAGES.TITLE_REQUIRED };
  if (categoryIds.length === 0) return { error: ERROR_MESSAGES.CATEGORY_REQUIRED };
  if (location.trim().length === 0) return { error: ERROR_MESSAGES.LOCATION_REQUIRED };

  // Imaginea s-a urcat CLIENT direct în Blob (vezi /api/blob/upload). Aici primim doar URL-ul →
  // acceptăm DOAR un URL de Blob al store-ului nostru (tipul/mărimea au fost impuse la token).
  const imageUrl = String(formData.get("imageUrl") ?? "");
  if (!isOwnBlobUrl(imageUrl)) return { error: ERROR_MESSAGES.IMAGE_REQUIRED };

  // SEC-02: validează real + re-encodează (fără metadata) + plafonează dimensiuni. Returnează un URL curat.
  const processed = await reprocessBlobImage(imageUrl, "details");
  if (!processed.ok) return { error: ERROR_MESSAGES.INVALID_TYPE };

  const result = await createDetail({
    authorId: userId,
    title,
    description,
    categoryIds,
    imageUrl: processed.url,
    location,
    climateZone,
    seismicAg,
    seismicTc,
    snowLoad,
    windLoad,
    resources,
  });

  if (!result.ok) {
    // Lipsa rolului declarat = îl trimitem la onboarding (nu e o eroare de formular).
    if (result.error === "NO_ROLE") {
      redirect("/onboarding");
    }
    return { error: ERROR_MESSAGES[result.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }

  // ADNOTAREA opțională a autorului peste propria imagine (desenată în formular). Detaliul e DEJA
  // publicat aici → o adnotare care eșuează NU trebuie să-l piardă: încercăm, și mergem mai departe
  // fie că a mers sau nu. Serviciul face validarea + authz (doar autorul își adnotează detaliul).
  const annotationStrokes = parseAnnotationStrokes(formData.get("annotationStrokes"));
  let hasAnnotation = false;
  // A ÎNCERCAT o adnotare și n-a mers? Userul trebuie să afle — altfel publică, nu-și vede desenul pe
  // detaliu și nu are cum să ghicească de ce (până la 2026-08-02 eșecul era complet tăcut, vizibil doar
  // în PostHog prin `has_annotation: false`). Nu e o eroare de formular: detaliul E publicat, deci mesajul
  // se dă pe pagina lui, nu aici. Cauza realistă e o indisponibilitate momentană de DB — deci „reîncearcă".
  let annotationFailed = false;
  if (annotationStrokes !== null) {
    const annotation = await createAnnotation({
      detailId: result.detailId,
      authorId: userId,
      strokes: annotationStrokes,
      // Nota e OPȚIONALĂ; serverul o validează (`validateSketchNote` — trim + lungime). Gol → null.
      note: formData.get("annotationNote"),
    });
    hasAnnotation = annotation.ok;
    annotationFailed = !annotation.ok;
  }

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: userId,
    event: "detail_published",
    properties: {
      detail_id: result.detailId,
      category_count: categoryIds.length,
      has_description: description.trim().length > 0,
      has_resources: resources.length > 0,
      resource_count: resources.length,
      has_annotation: hasAnnotation,
    },
  });
  await posthog.flush();

  // Detaliul nou apare în feed (listă + counts pe categorie) → invalidează cache-ul feed-ului.
  revalidatePath("/feed");

  // Publicat → ducem userul direct la pagina noului detaliu. `?annotation=failed` doar dacă adnotarea
  // (pas OPȚIONAL) n-a apucat să se salveze — pagina afișează un mesaj, detaliul rămâne publicat.
  redirect(
    annotationFailed
      ? `/details/${result.detailId}?annotation=failed`
      : `/details/${result.detailId}`,
  );
}

// „Salvează ciornă" pe formularul de adăugare — prima dată, deci nu există încă un id. Validare
// LENIENTĂ (doar titlul obligatoriu) — vezi `createDetailDraft`. Redirect la editorul ciornei
// (`/details/[id]/edit`), reutilizat pentru resave/publish ulterior.
export async function saveNewDetailDraftAction(
  _prev: CreateDetailState,
  formData: FormData,
): Promise<CreateDetailState> {
  const userId = await requireActiveUserId();

  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: ERROR_MESSAGES.RATE_LIMITED };
  }

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);
  const location = String(formData.get("location") ?? "");
  const climateZone = String(formData.get("climateZone") ?? "");
  const seismicAg = String(formData.get("seismicAg") ?? "");
  const seismicTc = String(formData.get("seismicTc") ?? "");
  const snowLoad = String(formData.get("snowLoad") ?? "");
  const windLoad = String(formData.get("windLoad") ?? "");
  const resources = readResources(formData);

  if (title.trim().length === 0) return { error: ERROR_MESSAGES.TITLE_REQUIRED };

  // Imaginea e OPȚIONALĂ la ciornă — doar dacă e prezentă o validăm/reprocesăm (SEC-02).
  const rawImageUrl = String(formData.get("imageUrl") ?? "");
  let imageUrl: string | null = null;
  if (rawImageUrl.length > 0) {
    if (!isOwnBlobUrl(rawImageUrl)) return { error: ERROR_MESSAGES.IMAGE_REQUIRED };
    const processed = await reprocessBlobImage(rawImageUrl, "details");
    if (!processed.ok) return { error: ERROR_MESSAGES.INVALID_TYPE };
    imageUrl = processed.url;
  }

  const result = await createDetailDraft({
    authorId: userId,
    title,
    description,
    categoryIds,
    imageUrl,
    location,
    climateZone,
    seismicAg,
    seismicTc,
    snowLoad,
    windLoad,
    resources,
  });

  if (!result.ok) {
    if (result.error === "NO_ROLE") redirect("/onboarding");
    return { error: ERROR_MESSAGES[result.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }

  redirect(`/details/${result.detailId}/edit`);
}
