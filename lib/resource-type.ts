// Tip pur, fără dependențe grele (next-auth/next/server) — extras din detail-form.tsx (2026-08-16)
// STRICT ca să poată fi testat unitar: importul componentei-formular întregi într-un test vitest
// eșuează (trage în lanț next-auth prin alte importuri ale fișierului, care nu rezolvă sub Node/vitest).

export type ResourceType = "IMAGE" | "LINK" | "PDF" | "CAD";

// IMAGE/PDF/CAD pot fi și încărcate direct (nu doar link) — LINK rămâne doar link.
export const UPLOADABLE_RESOURCE_TYPES = new Set<ResourceType>(["IMAGE", "PDF", "CAD"]);

// O resursă UPLOADABILĂ (IMAGE/PDF/CAD) al cărei URL arată a fi urcat de NOI (Vercel Blob), nu lipit
// de mână — 2026-08-16, raportat Liviu: „văd un link kilometric, nu știu ce e cu el" după upload.
// Doar heuristică de AFIȘARE (schimbă link-ul cu o previzualizare mică), NU o poartă de securitate —
// un fals-pozitiv rar (link extern care conține din întâmplare acest host) nu are consecințe reale,
// doar arată previzualizarea compactă în loc de câmp de text.
export function looksLikeUploadedResource(type: ResourceType, value: string): boolean {
  return UPLOADABLE_RESOURCE_TYPES.has(type) && /\.public\.blob\.vercel-storage\.com\//.test(value);
}
