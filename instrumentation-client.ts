// Sentry — runtime browser. Fără session replay (evităm captarea de imagini/date de profil ale userilor
// din construcții — nu e o decizie luată, o omitem prudent; se poate activa ulterior explicit).
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Logs structurate via `Sentry.logger.*` (intenționat, PII-free). Fără forwarding automat de console.*.
  enableLogs: true,
});

// Cerut de Sentry pentru instrumentarea navigărilor client-side (App Router).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
