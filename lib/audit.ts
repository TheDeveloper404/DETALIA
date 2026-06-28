// SEC-14 — Audit trail de securitate (evenimente structurate, fără PII brut).
//
// Filozofie: emitem o linie JSON pe stdout → Vercel Runtime Logs o ingerează (decizie: rămânem pe
// logurile native Vercel pentru MVP, fără Sentry). Pe baza acestor evenimente se pot construi alerte în
// dashboard (rate/cost) și se poate detecta volum anormal / abuz.
//
// REGULI:
//  - NICIODATĂ PII brut (email, token, OTP, IP brut, dovezi rol). Apelantul trimite doar id-uri interne
//    (userId = uuid, nu identifică o persoană fără DB) sau valori deja hash-uite. Vezi `hashAuditId`.
//  - Doar metadate + rezultat. Evenimentul = ce s-a întâmplat, nu conținutul.
//  - Best-effort: o eroare de logging NU trebuie să rateze cererea.
//
// NU importă `node:crypto` (sau alt API node-only) → sigur și în runtime edge (ex. `proxy.ts`).
// Hash-uirea unui identificator sensibil se face de apelant (vezi `hashEmail`/hashing din `lib/rate-limit.ts`).

export type AuditSeverity = "info" | "warning";

// Evenimente cunoscute (extinde pe măsură ce apar fluxuri: suspendări, decizii admin etc.).
export type AuditEvent =
  | "rate_limited" // cotă depășită (auth/mutație/upload/creare detaliu) — semnal de abuz/volum anormal
  | "access_denied_suspended"; // cont non-ACTIVE a încercat o rută protejată (SEC-04)

export function audit(
  event: AuditEvent,
  fields: Record<string, unknown> = {},
  severity: AuditSeverity = "info",
): void {
  try {
    // O singură linie JSON, prefix stabil pentru filtrare ușoară în Vercel Logs.
    console.log(JSON.stringify({ audit: true, ts: new Date().toISOString(), severity, event, ...fields }));
  } catch {
    // logging best-effort — nu propagăm niciodată o eroare de audit.
  }
}
