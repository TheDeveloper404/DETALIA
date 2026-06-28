"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { BLOB_URL_RE } from "@/lib/upload-limits";
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
  CATEGORY_REQUIRED: "Alege o categorie.",
  INVALID_CATEGORY: "Categoria aleasă nu există.",
  TOO_MANY_RESOURCES: "Prea multe resurse atașate (max 3).",
  INVALID_RESOURCE: "O resursă atașată e invalidă.",
};

export async function createDetailAction(
  _prev: CreateDetailState,
  formData: FormData,
): Promise<CreateDetailState> {
  // Deny-by-default: doar useri autentificați. authorId vine EXCLUSIV din sesiune, niciodată din client.
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const climateZone = String(formData.get("climateZone") ?? "");
  const seismicZone = String(formData.get("seismicZone") ?? "");
  const resources = readResources(formData);

  // Guard ieftin înainte de upload — evită blob-uri orfane dacă lipsesc câmpurile text.
  if (title.trim().length === 0) return { error: ERROR_MESSAGES.TITLE_REQUIRED };
  if (categoryId.trim().length === 0) return { error: ERROR_MESSAGES.CATEGORY_REQUIRED };

  // Imaginea s-a urcat CLIENT direct în Blob (vezi /api/blob/upload). Aici primim doar URL-ul →
  // acceptăm DOAR un URL de Blob al store-ului nostru (tipul/mărimea au fost impuse la token).
  const imageUrl = String(formData.get("imageUrl") ?? "");
  if (!BLOB_URL_RE.test(imageUrl)) return { error: ERROR_MESSAGES.IMAGE_REQUIRED };

  const result = await createDetail({
    authorId: session.user.id,
    title,
    description,
    categoryId,
    imageUrl,
    climateZone,
    seismicZone,
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
