// Sentry — runtime Node.js (server actions, route handlers, RSC). DSN vine din env (niciodată hardcodat).
// PII: `sendDefaultPii: false` explicit — regula proiectului e „fără PII în telemetrie" (vezi CLAUDE.md).
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // VERCEL_ENV ("production"/"preview"/"development") — fără el, toate evenimentele cad sub environment
  // implicit ("production"), invizibile la filtrare pe "vercel-preview" în dashboard.
  environment: process.env.VERCEL_ENV ?? "development",
  // Logs structurate via `Sentry.logger.*` (intenționat, PII-free). NU forwardăm console.* automat
  // (consoleLoggingIntegration) — ar putea trimite email/token în telemetrie (regula „fără PII", CLAUDE.md).
  enableLogs: true,
});
