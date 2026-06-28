// Limite upload imagine — sursa de adevăr, partajată client + server (NU importă `@vercel/blob`,
// ca să poată fi folosit și în componente client fără a trage SDK-ul de Blob în bundle).
// Re-validate ÎNTOTDEAUNA pe server (la emiterea tokenului de upload); validarea client e doar UX.

export const MAX_IMAGE_MB = 25;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
] as const;

// URL valid de Blob al store-ului nostru (acces public). Folosit la persistarea URL-ului întors
// de upload-ul client → nu acceptăm URL-uri arbitrare în DB.
export const BLOB_URL_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
