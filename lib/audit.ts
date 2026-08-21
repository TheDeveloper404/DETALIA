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
  | "rate_limit_disabled_in_prod" // RATE_LIMIT_FAIL_OPEN=true activ în producție — toate limiterele sunt no-op
  | "turnstile_disabled_in_prod" // TURNSTILE_SECRET_KEY absent în producție — verificarea anti-bot e no-op
  | "access_denied_suspended" // cont non-ACTIVE a încercat o rută protejată (SEC-04)
  | "maintenance_toggled" // admin a schimbat modul de mentenanță (acțiune administrativă cu impact global)
  | "admin_login_success" // autentificare reușită în panoul de admin
  | "admin_login_failed" // încercare eșuată de login admin (user inexistent / parolă greșită) — semnal brute-force
  | "admin_user_suspended" // admin a suspendat un cont (moderare reversibilă)
  | "admin_user_reactivated" // admin a reactivat un cont suspendat anterior
  | "notifications_retention_cleanup" // cron de retenție a șters notificări citite vechi (15 zile)
  // SEC-007 (audit securitate 2026-08-11): zero audit pe evenimentele de autorizare din feature-ul
  // „Proiect" — dacă incidentul SEC-004 (link de invitație vizibil oricărui membru) ar fi fost
  // exploatat, nu exista nicio urmă din care să se reconstituie cine a intrat, când, pe ce link.
  | "project_member_joined" // cineva s-a alăturat unui proiect prin link de invitație
  | "project_member_removed" // owner-ul a eliminat un membru
  | "project_invite_regenerated" // owner-ul a regenerat linkul de invitație (tokenul vechi devine invalid)
  | "project_deleted" // owner-ul a șters proiectul (ireversibil)
  | "project_forbidden_action" // non-owner a încercat o acțiune owner-only (regenerare/eliminare/ștergere)
  // SEC-013 (audit 2026-08-11): mutații declanșate de ștergerea contului owner-ului (GDPR), nu de o
  // acțiune directă a userului — trece pe lângă app/(app)/projects/actions.ts, deci fără urmă dacă nu
  // se auditează separat aici.
  | "project_ownership_transferred_on_account_deletion"
  | "project_deleted_on_account_deletion"
  // Găsit la /code-review QODO (2026-08-11): bucla per-proiect nu izola erorile — un proiect care
  // aruncă oprea reasignarea/ștergerea tuturor celorlalte proiecte deținute de contul șters.
  | "project_reassignment_failed_on_account_deletion";

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
