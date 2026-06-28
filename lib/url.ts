// SEC-03 — Validare allowlist pentru URL-uri introduse de useri (website profil).
// Pur, fără dependențe: parsare cu `new URL()` + allowlist strict http/https. Blochează scheme
// periculoase (javascript:, data:, file: etc.) la INPUT, nu doar la randare. Resursele detaliului
// au propriul gard la input (`isHttpUrl` din server/domain/detail.ts).

export type NormalizeWebsiteResult =
  | { ok: true; value: string | null }
  | { ok: false };

// Normalizează un website opțional: gol → null; fără schemă → prefixăm https://; apoi cerem http/https.
// Întoarce URL-ul normalizat (sau null), ori { ok: false } dacă schema nu e permisă / nu e parsabil.
export function normalizeWebsite(raw: string | null | undefined): NormalizeWebsiteResult {
  const trimmed = raw?.trim() ?? "";
  if (trimmed.length === 0) return { ok: true, value: null };

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false };
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false };
  }
}
