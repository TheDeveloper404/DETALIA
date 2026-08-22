import { resolveTrustedOrigin } from "@/lib/magic-link-url";

// SEC-03: allowlist strict — acceptăm DOAR URL-ul de callback Auth.js pe originea noastră
// (`/api/auth/callback/...`), niciodată un URL arbitrar (anti open-redirect/phishing).
//
// SEC-06 (audit 2026-08-22): originea de încredere vine din `resolveTrustedOrigin` (aceeași sursă ca
// linkul din email, `lib/magic-link-url.ts`) — NU din `AUTH_URL` direct. Înainte, cele două foloseau
// modele diferite de calcul al originii; după ce `AUTH_URL` a fost scos din scope-ul Preview (aceeași
// sesiune), aici ar fi rămas `http://localhost:3000`, rupând verificarea pe orice preview. Fișier
// separat de `app/verify/page.tsx` ca să rămână testabil izolat, fără importurile de React/Next ale paginii.
export function validateCallbackUrl(raw: string | undefined, host: string | null | undefined): string | null {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const expectedOrigin = new URL(resolveTrustedOrigin(host)).origin;
  if (parsed.origin !== expectedOrigin) return null;
  if (!parsed.pathname.startsWith("/api/auth/callback/")) return null;
  return parsed.toString();
}
