// Hash-ul token-urilor de admin (sesiune + magic link), izolat intenționat de `lib/admin-auth.ts`.
//
// De ce fișier separat: poarta de admin din `proxy.ts` trebuie să caute sesiunea în DB, deci are
// nevoie de aceeași funcție de hash — dar `lib/admin-auth.ts` importă `next/headers` (`cookies()`),
// care nu are ce căuta în bundle-ul proxy-ului. Alternativa (a redeclara hash-ul în proxy) a produs
// deja un bug: tokenul brut căutat într-o coloană care stochează hash-ul → poarta nu recunoștea
// NICIO sesiune validă, iar pagina de login o recunoștea → buclă infinită de redirect pe /admin-page.
//
// Token-urile brute circulă doar în link-ul de email / cookie-ul HttpOnly. În DB se stochează
// exclusiv hash-ul (SHA-256) — un read neautorizat al tabelelor admin_login_tokens/admin_sessions
// (backup exfiltrat, query mis-scopat) nu mai produce direct un token replay-abil.
//
// REGULĂ: orice căutare/ștergere după token în `admin_sessions` sau `admin_login_tokens` trece prin
// `hashToken()`. Nu compara niciodată valoarea brută din cookie direct cu coloana.
import { createHash } from "node:crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
