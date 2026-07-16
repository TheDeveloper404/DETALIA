// SEC-14 — Audit trail de securitate (evenimente structurate, fără PII brut).
//
// Filozofie: emitem o linie JSON pe stdout → Vercel Runtime Logs o ingerează. Pe baza acestor
// evenimente se pot construi alerte în dashboard (rate/cost) și se poate detecta volum anormal / abuz.
//
// REGULI:
//  - NICIODATĂ PII brut (email, token, OTP, IP brut, dovezi rol). Apelantul trimite doar id-uri interne
//    (userId = uuid, nu identifică o persoană fără DB) sau valori deja hash-uite. Vezi `hashAuditId`.
//  - Doar metadate + rezultat. Evenimentul = ce s-a întâmplat, nu conținutul.
//  - Best-effort: o eroare de logging NU trebuie să rateze cererea.
//
// NU importă `node:crypto` (sau alt API node-only) → sigur și în runtime edge (ex. `proxy.ts`).
// Hash-uirea unui identificator sensibil se face de apelant (vezi `hashEmail`/hashing din `lib/rate-limit.ts`).
//
// warning/error → trimise ȘI către PostHog (eveniment `audit_event`), pentru ca alertele PostHog să le
// poată prinde — altfel evenimentele stăteau doar în Vercel Logs, nevăzute activ. (Sentry a fost scos
// 2026-07-16 — decommission asumat, PostHog acoperă deja error tracking-ul.)
import { reportServerEvent } from "@/lib/posthog-report";

export type AuditSeverity = "info" | "warning" | "error";

// Evenimente cunoscute (extinde pe măsură ce apar fluxuri: suspendări, decizii admin etc.).
export type AuditEvent =
  | "rate_limited" // cotă depășită (auth/mutație/upload/creare detaliu) — semnal de abuz/volum anormal
  | "rate_limit_unavailable" // Redis indisponibil/outage — limiterul nu a putut decide (fail-open/closed după mediu)
  | "access_denied_suspended" // cont non-ACTIVE a încercat o rută protejată (SEC-04)
  | "maintenance_toggled" // admin a schimbat modul de mentenanță (acțiune administrativă cu impact global)
  | "admin_login_success" // autentificare reușită în panoul de admin
  | "admin_login_failed" // încercare eșuată de login admin (user inexistent / parolă greșită) — semnal brute-force
  | "admin_user_suspended" // admin a suspendat un cont (moderare reversibilă)
  | "admin_user_reactivated" // admin a reactivat un cont suspendat anterior
  | "notifications_retention_cleanup"; // cron de retenție a șters notificări citite vechi (15 zile)

export function audit(
  event: AuditEvent,
  fields: Record<string, unknown> = {},
  severity: AuditSeverity = "info",
): void {
  try {
    // O singură linie JSON, prefix stabil pentru filtrare ușoară în Vercel Logs.
    console.log(JSON.stringify({ audit: true, ts: new Date().toISOString(), severity, event, ...fields }));
    if (severity !== "info") {
      reportServerEvent("audit_event", { audit_event: event, severity, ...fields });
    }
  } catch {
    // logging best-effort — nu propagăm niciodată o eroare de audit.
  }
}
