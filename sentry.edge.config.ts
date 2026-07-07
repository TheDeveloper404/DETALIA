// Sentry — runtime Edge (proxy.ts / Next 16 middleware). Vezi sentry.server.config.ts pentru context.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Vezi sentry.server.config.ts pt motivul environment-ului explicit.
  environment: process.env.VERCEL_ENV ?? "development",
  // Logs structurate via `Sentry.logger.*` (intenționat, PII-free). Fără forwarding automat de console.*.
  enableLogs: true,
});
