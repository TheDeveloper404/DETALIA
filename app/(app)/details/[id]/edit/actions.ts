"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { reprocessBlobImage } from "@/lib/image-processing";
import { deleteBlobs } from "@/lib/storage";
import { BLOB_URL_RE } from "@/lib/upload-limits";
import { type DetailResourceInput, isValidResourceType } from "@/server/domain/detail";
import { updateDetail } from "@/server/services/detailService";

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
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const detailId = String(formData.get("detailId") ?? "");
  if (detailId.length === 0) return { error: ERROR_MESSAGES.NOT_FOUND };

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);
  const climateZone = String(formData.get("climateZone") ?? "");
  const seismicAg = String(formData.get("seismicAg") ?? "");
  const seismicTc = String(formData.get("seismicTc") ?? "");
  const snowLoad = String(formData.get("snowLoad") ?? "");
  const windLoad = String(formData.get("windLoad") ?? "");
  const resources = readResources(formData);

  if (title.trim().length === 0) return { error: ERROR_MESSAGES.TITLE_REQUIRED };
  if (categoryIds.length === 0) return { error: ERROR_MESSAGES.CATEGORY_REQUIRED };

  const imageUrl = String(formData.get("imageUrl") ?? "");
  if (!BLOB_URL_RE.test(imageUrl)) return { error: ERROR_MESSAGES.IMAGE_REQUIRED };

  // Imaginea se reprocesează (validare + re-encodare fără metadata) DOAR dacă userul a schimbat-o.
  // Dacă a rămas cea existentă, e deja procesată → o trimitem ca atare (fără blob nou/orfan).
  const imageChanged = String(formData.get("imageChanged") ?? "") === "1";
  let finalImageUrl = imageUrl;
  if (imageChanged) {
    const processed = await reprocessBlobImage(imageUrl, "details");
    if (!processed.ok) return { error: ERROR_MESSAGES.INVALID_TYPE };
    finalImageUrl = processed.url;
  }

  const result = await updateDetail({
    detailId,
    userId: session.user.id,
    title,
    description,
    categoryIds,
    imageUrl: finalImageUrl,
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

  // Detaliul editat: reîmprospătează pagina lui + feed-ul (titlu/categorii se pot fi schimbat).
  revalidatePath(`/details/${detailId}`);
  revalidatePath("/feed");
  redirect(`/details/${detailId}`);
}
