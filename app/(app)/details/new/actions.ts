"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { reprocessBlobImage } from "@/lib/image-processing";
import { checkLimit, limiters } from "@/lib/rate-limit";
import { requireActiveUserId } from "@/lib/require-active-user";
import { isOwnBlobUrl } from "@/lib/blob-url";
import { type DetailResourceInput, isValidResourceType } from "@/server/domain/detail";
import { createDetail } from "@/server/services/detailService";

export type CreateDetailState = { error: string | null };

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
  const climateZone = String(formData.get("climateZone") ?? "");
  const seismicAg = String(formData.get("seismicAg") ?? "");
  const seismicTc = String(formData.get("seismicTc") ?? "");
  const snowLoad = String(formData.get("snowLoad") ?? "");
  const windLoad = String(formData.get("windLoad") ?? "");
  const resources = readResources(formData);

  // Guard ieftin înainte de upload — evită blob-uri orfane dacă lipsesc câmpurile text.
  if (title.trim().length === 0) return { error: ERROR_MESSAGES.TITLE_REQUIRED };
  if (categoryIds.length === 0) return { error: ERROR_MESSAGES.CATEGORY_REQUIRED };

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

  // Detaliul nou apare în feed (listă + counts pe categorie) → invalidează cache-ul feed-ului.
  revalidatePath("/feed");

  // Publicat → ducem userul direct la pagina noului detaliu.
  redirect(`/details/${result.detailId}`);
}
