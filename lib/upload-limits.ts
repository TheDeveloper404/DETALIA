// Limite upload imagine — sursa de adevăr, partajată client + server (NU importă `@vercel/blob`,
// ca să poată fi folosit și în componente client fără a trage SDK-ul de Blob în bundle).
// Re-validate ÎNTOTDEAUNA pe server (la emiterea tokenului de upload); validarea client e doar UX.

export const MAX_IMAGE_MB = 25;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

// Latura cea mai lungă acceptată de server la re-procesare (`MAX_DIMENSION`, `lib/image-processing.ts`,
// care nu poate fi importat client-side — trage `sharp`). Exportat aici ca plafon comun pentru orice
// randare client care produce o imagine ce va fi re-urcată ca sursă (thumbnail schiță, export planșă) —
// randarea LA acest plafon (nu sub el, cu o marjă arbitrară) evită să pierdem rezoluție înainte ca
// serverul să apuce s-o plafoneze el (bug găsit 2026-08-18: ambele exporturi client rămâneau mult sub
// acest plafon — 1000px, respectiv 2400px — fără niciun motiv legat de limita reală de server).
export const MAX_CLIENT_EXPORT_DIMENSION = 4096;

// Avatar/cover de profil — limită separată, mai mică (nu au nevoie de rezoluția unei imagini de detaliu tehnic).
export const MAX_AVATAR_MB = 8;
export const MAX_AVATAR_BYTES = MAX_AVATAR_MB * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
] as const;

export const MAX_DOC_MB = 25;
export const MAX_DOC_BYTES = MAX_DOC_MB * 1024 * 1024;
export const ALLOWED_DOC_TYPES = ["application/pdf"] as const;

// DWG/DXF nu au un MIME type standardizat (browserele raportează des "" sau
// application/octet-stream) → validarea reală a extensiei se face server-side pe pathname
// (vezi /api/blob/upload), nu doar pe content-type.
export const MAX_CAD_MB = 50;
export const MAX_CAD_BYTES = MAX_CAD_MB * 1024 * 1024;
export const ALLOWED_CAD_TYPES = [
  "application/octet-stream",
  "image/vnd.dwg",
  "image/vnd.dxf",
  "application/dxf",
  "application/dwg",
  "application/x-dwg",
  "application/acad",
] as const;
export const ALLOWED_CAD_EXTENSIONS = ["dwg", "dxf"] as const;

// Oferte de materiale (Furnizor) — PDF/Excel/CSV. La fel ca CAD: xls/xlsx/csv n-au un content-type de
// încredere din browser (Excel vechi trimite des "application/octet-stream" sau "application/vnd.ms-excel"
// și pentru .xlsx) → gate real pe extensia din pathname (vezi /api/blob/upload), content-type e doar
// informativ aici.
export const MAX_MATERIAL_MB = 25;
export const MAX_MATERIAL_BYTES = MAX_MATERIAL_MB * 1024 * 1024;
export const MAX_MATERIAL_FILES_PER_OFFER = 10;
export const ALLOWED_MATERIAL_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls (și des trimis greșit pt .xlsx/.csv)
  "text/csv",
  "application/csv",
  "text/plain", // unele browsere trimit asta pt .csv
  "application/octet-stream",
] as const;
export const ALLOWED_MATERIAL_EXTENSIONS = ["pdf", "xlsx", "xls", "csv"] as const;

// URL valid de Blob al store-ului nostru (acces public). Folosit la persistarea URL-ului întors
// de upload-ul client → nu acceptăm URL-uri arbitrare în DB.
export const BLOB_URL_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
