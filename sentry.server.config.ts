// Sentry — runtime Node.js (server actions, route handlers, RSC). DSN vine din env (niciodată hardcodat).
// PII: `sendDefaultPii: false` explicit — regula proiectului e „fără PII în telemetrie" (vezi CLAUDE.md).
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
