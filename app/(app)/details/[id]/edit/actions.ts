"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { reprocessBlobImage } from "@/lib/image-processing";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import { deleteBlobs } from "@/lib/storage";
import { isUsersBlobUrl } from "@/lib/blob-url";
import { type DetailResourceInput, isValidResourceType } from "@/server/domain/detail";
import { publishDetailDraft, saveDetailDraft, updateDetail } from "@/server/services/detailService";
import { parseAnnotationStrokes } from "@/lib/annotation-form";
import { createAnnotation, deleteSketch, updateAnnotation } from "@/server/services/sketchService";

export type EditDetailState = { error: string | null };

// Resursele vin ca JSON dintr-un câmp ascuns (repeater pe client). Parsare defensivă — identică
// cu cea din fluxul de creare.
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

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_TYPE: "Imaginea trebuie să fie PNG, JPG, WebP sau AVIF.",
  TITLE_REQUIRED: "Titlul e obligatoriu.",
  TITLE_TOO_LONG: "Titlul e prea lung (max 200 de caractere).",
  DESCRIPTION_TOO_LONG: "Textul e prea lung (max 5000 de caractere).",
  IMAGE_REQUIRED: "Detaliul trebuie să aibă o imagine.",
  CATEGORY_REQUIRED: "Alege cel puțin o categorie.",
  TOO_MANY_CATEGORIES: "Prea multe categorii bifate.",
  INVALID_ZONE: "Una dintre valorile de zonă/încărcare nu e validă.",
  LOCATION_REQUIRED: "Completează țara și orașul.",
  LOCATION_TOO_LONG: "Locația e prea lungă (max 200 de caractere).",
  INVALID_CATEGORY: "Una dintre categoriile alese nu există.",
  TOO_MANY_RESOURCES: "Prea multe resurse atașate (max 3).",
  INVALID_RESOURCE: "O resursă atașată e invalidă.",
  NOT_FOUND: "Detaliul nu există.",
  FORBIDDEN: "Nu poți edita acest detaliu.",
};

export async function updateDetailAction(
  _prev: EditDetailState,
  formData: FormData,
): Promise<EditDetailState> {
  // Deny-by-default: doar useri autentificați. userId vine EXCLUSIV din sesiune.
  // SEC-04: re-check status proaspăt din DB (sesiune JWT stale) — cont suspendat nu poate edita detalii.
  const userId = await requireActiveUserId();
  // SEC-003: fără limită, imageChanged=1 declanșează reprocesare sharp + scriere/ștergere Blob la
  // nesfârșit — singura acțiune din fișier fără checkLimit (vezi saveDraftDetailAction/publishDraftDetailAction).
  if (!(await checkLimit(limiters.mutation, userId)).ok) {
    return { error: "Prea multe salvări într-un timp scurt." };
  }

  const detailId = String(formData.get("detailId") ?? "");
  if (detailId.length === 0) return { error: ERROR_MESSAGES.NOT_FOUND };

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
  if (categoryIds.length === 0) return { error: ERROR_MESSAGES.CATEGORY_REQUIRED };
  if (location.trim().length === 0) return { error: ERROR_MESSAGES.LOCATION_REQUIRED };

  const imageUrl = String(formData.get("imageUrl") ?? "");
  if (!isUsersBlobUrl(imageUrl, userId)) return { error: ERROR_MESSAGES.IMAGE_REQUIRED };

  // Imaginea se reprocesează (validare + re-encodare fără metadata) DOAR dacă userul a schimbat-o.
  // Dacă a rămas cea existentă, e deja procesată → o trimitem ca atare (fără blob nou/orfan).
  const imageChanged = String(formData.get("imageChanged") ?? "") === "1";
  let finalImageUrl = imageUrl;
  if (imageChanged) {
    const processed = await reprocessBlobImage(imageUrl, "details", userId);
    if (!processed.ok) return { error: ERROR_MESSAGES.INVALID_TYPE };
    finalImageUrl = processed.url;
  }

  const result = await updateDetail({
    detailId,
    userId,
    title,
    description,
    categoryIds,
    imageUrl: finalImageUrl,
    location,
    climateZone,
    seismicAg,
    seismicTc,
    snowLoad,
    windLoad,
    resources,
  });

  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] ?? "Ceva n-a mers. Încearcă din nou." };
  }

  // Imaginea s-a schimbat → curăță blob-ul vechi (best-effort, după commit-ul DB).
  if (result.oldImageUrl) {
    await deleteBlobs([result.oldImageUrl]);
  }

  // ADNOTAREA (2026-08-11): editabilă din pagina de Editare detaliu, ca titlul/descrierea. Detaliul e
  // DEJA salvat aici — o adnotare care eșuează NU trebuie să piardă restul editării (best-effort, ca la
  // creare — vezi app/(app)/details/new/actions.ts). `annotationSketchId` gol = nu exista încă una
  // (`createAnnotation`); altfel înlocuiește pe loc rândul existent (`updateAnnotation`).
  const annotationStrokes = parseAnnotationStrokes(formData.get("annotationStrokes"));
  const annotationSketchId = String(formData.get("annotationSketchId") ?? "");
  if (annotationStrokes !== null) {
    if (annotationSketchId.length > 0) {
      await updateAnnotation({
        detailId,
        sketchId: annotationSketchId,
        authorId: userId,
        strokes: annotationStrokes,
        note: formData.get("annotationNote"),
      });
    } else {
      await createAnnotation({
        detailId,
        authorId: userId,
        strokes: annotationStrokes,
        note: formData.get("annotationNote"),
      });
    }
  } else if (annotationSketchId.length > 0) {
    // Golit complet la „Gata" (0 trasee → `annotationStrokes` gol în formular): fără ramura asta,
    // câmpul gol se confunda cu „nicio adnotare atinsă" și rândul vechi rămânea neschimbat, silențios
    // (găsit la /code-review, 2026-08-11) — userul vedea „Adnotează" pe buton, credea că a șters, dar
    // desenul vechi supraviețuia neatins. Ștergerea reală trece prin `deleteSketch` — respectă regula
    // de stack (o adnotare pe care alții au construit nu dispare complet, ca orice altă foaie blocată).
    await deleteSketch({ sketchId: annotationSketchId, actorUserId: userId });
  }

  // Detaliul editat: reîmprospătează pagina lui + feed-ul (titlu/categorii se pot fi schimbat).
  revalidatePath(`/details/${detailId}`);
  revalidatePath("/feed");
  redirect(`/details/${detailId}`);
}

// Câmpurile comune citite din formular pt cele două acțiuni de ciornă de mai jos.
function readDraftFields(formData: FormData) {
  return {
    detailId: String(formData.get("detailId") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    categoryIds: formData.getAll("categoryIds").map(String).filter(Boolean),
    location: String(formData.get("location") ?? ""),
    climateZone: String(formData.get("climateZone") ?? ""),
    seismicAg: String(formData.get("seismicAg") ?? ""),
    seismicTc: String(formData.get("seismicTc") ?? ""),
    snowLoad: String(formData.get("snowLoad") ?? ""),
    windLoad: String(formData.get("windLoad") ?? ""),
    resources: readResources(formData),
  };
}

// Imaginea e OPȚIONALĂ la ciornă — validăm/reprocesăm (SEC-02) doar dacă e prezentă/schimbată.
async function resolveDraftImageUrl(formData: FormData, userId: string): Promise<
  { ok: true; imageUrl: string | null } | { ok: false; error: string }
> {
  const rawImageUrl = String(formData.get("imageUrl") ?? "");
  if (rawImageUrl.length === 0) return { ok: true, imageUrl: null };
  if (!isUsersBlobUrl(rawImageUrl, userId)) return { ok: false, error: ERROR_MESSAGES.INVALID_TYPE };

  const imageChanged = String(formData.get("imageChanged") ?? "") === "1";
  if (!imageChanged) return { ok: true, imageUrl: rawImageUrl };

  const processed = await reprocessBlobImage(rawImageUrl, "details", userId);
  if (!processed.ok) return { ok: false, error: ERROR_MESSAGES.INVALID_TYPE };
  return { ok: true, imageUrl: processed.url };
}

// Re-salvează o ciornă existentă (autorul, doar cât e DRAFT) — validare LENIENTĂ. Nu redirecționează
// (rămâne pe editor, ca la autosave-ul schiței) — doar arată eroarea, dacă există.
export async function saveDraftDetailAction(
  _prev: EditDetailState,
  formData: FormData,
): Promise<EditDetailState> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.mutation, userId)).ok) return { error: "Prea multe salvări într-un timp scurt." };

  const fields = readDraftFields(formData);
  if (fields.detailId.length === 0) return { error: ERROR_MESSAGES.NOT_FOUND };
  if (fields.title.trim().length === 0) return { error: ERROR_MESSAGES.TITLE_REQUIRED };

  const image = await resolveDraftImageUrl(formData, userId);
  if (!image.ok) return { error: image.error };

  const result = await saveDetailDraft({ ...fields, authorId: userId, imageUrl: image.imageUrl });
  if (!result.ok) return { error: ERROR_MESSAGES[result.error] ?? "Ceva n-a mers. Încearcă din nou." };

  revalidatePath(`/details/${fields.detailId}/edit`);
  return { error: null };
}

// Publică o ciornă (DRAFT → PUBLISHED) — validare STRICTĂ (imagine + categorie obligatorii).
export async function publishDraftDetailAction(
  _prev: EditDetailState,
  formData: FormData,
): Promise<EditDetailState> {
  const userId = await requireActiveUserId();
  if (!(await checkLimit(limiters.createDetail, userId)).ok) {
    return { error: "Prea multe detalii publicate într-un timp scurt. Încearcă mai târziu." };
  }

  const fields = readDraftFields(formData);
  if (fields.detailId.length === 0) return { error: ERROR_MESSAGES.NOT_FOUND };

  const image = await resolveDraftImageUrl(formData, userId);
  if (!image.ok) return { error: image.error };
  if (!image.imageUrl) return { error: ERROR_MESSAGES.IMAGE_REQUIRED };

  const result = await publishDetailDraft({ ...fields, authorId: userId, imageUrl: image.imageUrl });
  if (!result.ok) return { error: ERROR_MESSAGES[result.error] ?? "Ceva n-a mers. Încearcă din nou." };

  revalidatePath("/feed");
  redirect(`/details/${fields.detailId}`);
}
